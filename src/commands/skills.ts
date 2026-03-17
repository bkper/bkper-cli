import fs from 'fs';
import os from 'os';
import path from 'path';
import * as YAML from 'yaml';

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

const SKILLS_REPO = 'bkper/skills';
const SKILLS_BASE_PATH = 'skills';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

export function getSkillsDirectory(homeDir: string = os.homedir()): string {
    return path.join(homeDir, '.agents', 'skills');
}

export function getSkillsStateFile(homeDir: string = os.homedir()): string {
    return path.join(getSkillsDirectory(homeDir), '.bkper-skills.yaml');
}

function getLocalCommit(): string | null {
    const skillsStateFile = getSkillsStateFile();

    try {
        if (fs.existsSync(skillsStateFile)) {
            const content = fs.readFileSync(skillsStateFile, 'utf8');
            const state: SkillsState = YAML.parse(content);
            return state.commit || null;
        }
    } catch {
        // Ignore errors, treat as no commit
    }
    return null;
}

function saveLocalCommit(commit: string): void {
    const skillsStateFile = getSkillsStateFile();
    fs.mkdirSync(path.dirname(skillsStateFile), { recursive: true });
    const state: SkillsState = { commit };
    fs.writeFileSync(skillsStateFile, YAML.stringify(state), 'utf8');
}

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

async function downloadSkillDirectory(skillName: string, targetDir: string): Promise<void> {
    const skillPath = `${SKILLS_BASE_PATH}/${skillName}`;
    const files = await fetchGitHubDirectory(SKILLS_REPO, skillPath);

    for (const file of files) {
        const localPath = path.join(targetDir, file.name);

        if (file.type === 'dir') {
            fs.mkdirSync(localPath, { recursive: true });
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

function clearBkperSkills(skillsDir: string): void {
    if (!fs.existsSync(skillsDir)) {
        return;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('bkper-')) {
            fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
        }
    }
}

async function fetchAvailableSkills(): Promise<string[]> {
    const files = await fetchGitHubDirectory(SKILLS_REPO, SKILLS_BASE_PATH);
    return files.filter(f => f.type === 'dir' && f.name.startsWith('bkper-')).map(f => f.name);
}

function getInstalledBkperSkills(skillsDir: string): string[] {
    if (!fs.existsSync(skillsDir)) {
        return [];
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('bkper-'))
        .map(entry => entry.name);
}

function shortSha(sha: string): string {
    return sha.substring(0, 7);
}

export interface UpdateSkillsResult {
    updated: string[];
    skipped: boolean;
    reason?: string;
    commit?: string;
}

export interface UpdateSkillsOptions {
    silent?: boolean;
}

export async function updateSkills(options: UpdateSkillsOptions = {}): Promise<UpdateSkillsResult> {
    const skillsDir = getSkillsDirectory();

    try {
        const remoteCommit = await fetchLatestCommit();
        const localCommit = getLocalCommit();

        const installedSkills = getInstalledBkperSkills(skillsDir);
        const skillsExist = installedSkills.length > 0;

        if (remoteCommit === localCommit && skillsExist) {
            return {
                updated: [],
                skipped: true,
                reason: `Skills are up to date (${shortSha(localCommit)})`,
                commit: localCommit,
            };
        }

        const availableSkills = await fetchAvailableSkills();

        if (availableSkills.length === 0) {
            return {
                updated: [],
                skipped: true,
                reason: 'No bkper-* skills found in repository',
            };
        }

        clearBkperSkills(skillsDir);
        fs.mkdirSync(skillsDir, { recursive: true });

        const updated: string[] = [];
        for (const skillName of availableSkills) {
            const skillTargetDir = path.join(skillsDir, skillName);
            fs.mkdirSync(skillTargetDir, { recursive: true });

            try {
                await downloadSkillDirectory(skillName, skillTargetDir);
                updated.push(skillName);
            } catch (err) {
                if (!options.silent) {
                    console.error(
                        `  Warning: Failed to download skill '${skillName}':`,
                        err instanceof Error ? err.message : err
                    );
                }
            }
        }

        saveLocalCommit(remoteCommit);

        return {
            updated,
            skipped: false,
            commit: remoteCommit,
        };
    } catch (err) {
        return {
            updated: [],
            skipped: true,
            reason: `Could not check for updates: ${err instanceof Error ? err.message : err}`,
        };
    }
}
