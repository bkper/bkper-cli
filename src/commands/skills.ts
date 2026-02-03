import fs from 'fs';
import os from 'os';
import path from 'path';
import * as YAML from 'yaml';

// =============================================================================
// Types
// =============================================================================

interface GitHubFile {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url: string | null;
}

interface GitHubCommit {
    sha: string;
}

interface SkillsState {
    commit: string;
}

// =============================================================================
// Constants
// =============================================================================

const SKILLS_REPO = 'bkper/skills';
const SKILLS_BASE_PATH = 'skills';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

// Global paths
const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'bkper');
const SKILLS_STATE_FILE = path.join(CONFIG_DIR, 'skills.yaml');

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the current local commit SHA from ~/.config/bkper/skills.yaml
 */
function getLocalCommit(): string | null {
    try {
        if (fs.existsSync(SKILLS_STATE_FILE)) {
            const content = fs.readFileSync(SKILLS_STATE_FILE, 'utf8');
            const state: SkillsState = YAML.parse(content);
            return state.commit || null;
        }
    } catch {
        // Ignore errors, treat as no commit
    }
    return null;
}

/**
 * Saves the current commit SHA to ~/.config/bkper/skills.yaml
 */
function saveLocalCommit(commit: string): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const state: SkillsState = { commit };
    fs.writeFileSync(SKILLS_STATE_FILE, YAML.stringify(state), 'utf8');
}

/**
 * Fetches the latest commit SHA that touched the skills/ folder.
 */
async function fetchLatestCommit(): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${SKILLS_REPO}/commits?path=${SKILLS_BASE_PATH}&per_page=1`;

    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'bkper-cli',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch commit: ${response.statusText}`);
    }

    const commits = (await response.json()) as GitHubCommit[];
    if (!commits.length) {
        throw new Error('No commits found for skills path');
    }

    return commits[0].sha;
}

/**
 * Fetches the list of files in a GitHub directory.
 */
async function fetchGitHubDirectory(repo: string, dirPath: string): Promise<GitHubFile[]> {
    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${dirPath}`;

    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'bkper-cli',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    return response.json() as Promise<GitHubFile[]>;
}

/**
 * Downloads a file from GitHub raw content.
 */
async function downloadGitHubFile(repo: string, filePath: string): Promise<string> {
    const url = `${GITHUB_RAW_BASE}/${repo}/main/${filePath}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'bkper-cli',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    return response.text();
}

/**
 * Recursively downloads a skill directory from GitHub.
 */
async function downloadSkillDirectory(skillName: string, targetDir: string): Promise<void> {
    const skillPath = `${SKILLS_BASE_PATH}/${skillName}`;
    const files = await fetchGitHubDirectory(SKILLS_REPO, skillPath);

    for (const file of files) {
        const localPath = path.join(targetDir, file.name);

        if (file.type === 'dir') {
            fs.mkdirSync(localPath, { recursive: true });
            // Recursively download subdirectory
            const subFiles = await fetchGitHubDirectory(SKILLS_REPO, file.path);
            for (const subFile of subFiles) {
                if (subFile.type === 'file' && subFile.download_url) {
                    const content = await downloadGitHubFile(SKILLS_REPO, subFile.path);
                    fs.writeFileSync(path.join(localPath, subFile.name), content, 'utf8');
                }
            }
        } else if (file.type === 'file') {
            const content = await downloadGitHubFile(SKILLS_REPO, file.path);
            fs.writeFileSync(localPath, content, 'utf8');
        }
    }
}

/**
 * Removes all bkper-* skill directories from the global skills folder.
 */
function clearBkperSkills(): void {
    if (!fs.existsSync(SKILLS_DIR)) {
        return;
    }

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('bkper-')) {
            fs.rmSync(path.join(SKILLS_DIR, entry.name), { recursive: true });
        }
    }
}

/**
 * Gets the list of available skills from GitHub.
 */
async function fetchAvailableSkills(): Promise<string[]> {
    const files = await fetchGitHubDirectory(SKILLS_REPO, SKILLS_BASE_PATH);
    return files.filter(f => f.type === 'dir' && f.name.startsWith('bkper-')).map(f => f.name);
}

/**
 * Gets the list of installed bkper-* skills from ~/.claude/skills/
 */
function getInstalledBkperSkills(): string[] {
    if (!fs.existsSync(SKILLS_DIR)) {
        return [];
    }

    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('bkper-'))
        .map(entry => entry.name);
}

/**
 * Returns a short version of the commit SHA for display.
 */
function shortSha(sha: string): string {
    return sha.substring(0, 7);
}

// =============================================================================
// Public API
// =============================================================================

export interface UpdateSkillsResult {
    updated: string[];
    skipped: boolean;
    reason?: string;
    commit?: string;
}

/**
 * Updates global Bkper skills in ~/.claude/skills/
 *
 * Fetches the latest commit SHA that touched the skills/ folder and compares
 * with ~/.config/bkper/skills.yaml. If commits differ, downloads all
 * bkper-* skills.
 *
 * @returns Result indicating what was updated
 */
export async function updateSkills(): Promise<UpdateSkillsResult> {
    try {
        // 1. Fetch latest commit that touched skills/
        const remoteCommit = await fetchLatestCommit();
        const localCommit = getLocalCommit();

        // 2. Check if update is needed (commit differs OR skills are missing)
        const installedSkills = getInstalledBkperSkills();
        const skillsExist = installedSkills.length > 0;

        if (remoteCommit === localCommit && skillsExist) {
            return {
                updated: [],
                skipped: true,
                reason: `Skills are up to date (${shortSha(localCommit)})`,
                commit: localCommit,
            };
        }

        // 3. Get list of available skills
        const availableSkills = await fetchAvailableSkills();

        if (availableSkills.length === 0) {
            return {
                updated: [],
                skipped: true,
                reason: 'No bkper-* skills found in repository',
            };
        }

        // 4. Clear existing bkper-* skills
        clearBkperSkills();

        // 5. Create skills directory
        fs.mkdirSync(SKILLS_DIR, { recursive: true });

        // 6. Download all skills
        const updated: string[] = [];
        for (const skillName of availableSkills) {
            const skillTargetDir = path.join(SKILLS_DIR, skillName);
            fs.mkdirSync(skillTargetDir, { recursive: true });

            try {
                await downloadSkillDirectory(skillName, skillTargetDir);
                updated.push(skillName);
            } catch (err) {
                // Log but continue with other skills
                console.error(
                    `  Warning: Failed to download skill '${skillName}':`,
                    err instanceof Error ? err.message : err
                );
            }
        }

        // 7. Save new commit
        saveLocalCommit(remoteCommit);

        return {
            updated,
            skipped: false,
            commit: remoteCommit,
        };
    } catch (err) {
        // Network error or other failure - silently continue
        return {
            updated: [],
            skipped: true,
            reason: `Could not check for updates: ${err instanceof Error ? err.message : err}`,
        };
    }
}
