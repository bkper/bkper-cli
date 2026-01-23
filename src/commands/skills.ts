import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';

// =============================================================================
// Types
// =============================================================================

interface SkillsConfig {
  autoUpdate?: boolean;
  installed?: string[];
}

interface AppConfig {
  skills?: SkillsConfig;
}

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const SKILLS_REPO = 'bkper/skills';
const SKILLS_BASE_PATH = 'skills';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const LOCAL_SKILLS_DIR = '.claude/skills';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Loads app configuration from bkperapp.yaml in the given directory.
 */
function loadAppConfigFromDir(projectDir: string): AppConfig {
  const yamlPath = path.join(projectDir, 'bkperapp.yaml');
  const jsonPath = path.join(projectDir, 'bkperapp.json');

  if (fs.existsSync(yamlPath)) {
    return YAML.parse(fs.readFileSync(yamlPath, 'utf8'));
  } else if (fs.existsSync(jsonPath)) {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }

  throw new Error('bkperapp.yaml or bkperapp.json not found');
}

/**
 * Fetches the list of files in a GitHub directory.
 */
async function fetchGitHubDirectory(
  repo: string,
  dirPath: string
): Promise<GitHubFile[]> {
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
async function downloadGitHubFile(
  repo: string,
  filePath: string
): Promise<string> {
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
async function downloadSkillDirectory(
  skillName: string,
  targetDir: string
): Promise<void> {
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

// =============================================================================
// Public API
// =============================================================================

export interface UpdateSkillsOptions {
  /** Project directory (defaults to current directory) */
  projectDir?: string;
  /** Print progress messages */
  verbose?: boolean;
}

export interface UpdateSkillsResult {
  updated: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Updates skills in the project based on bkperapp.yaml configuration.
 *
 * Reads the skills.installed array from bkperapp.yaml and downloads
 * each skill from github.com/bkper/skills to .claude/skills/
 *
 * @param options - Update options
 * @returns Result indicating what was updated
 */
export async function updateSkills(
  options: UpdateSkillsOptions = {}
): Promise<UpdateSkillsResult> {
  const { projectDir = process.cwd(), verbose = false } = options;

  // 1. Load app config
  let config: AppConfig;
  try {
    config = loadAppConfigFromDir(projectDir);
  } catch {
    return {
      updated: [],
      skipped: true,
      reason: 'No bkperapp.yaml found',
    };
  }

  // 2. Check if skills are configured
  const skillsConfig = config.skills;
  if (!skillsConfig) {
    return {
      updated: [],
      skipped: true,
      reason: 'No skills section in bkperapp.yaml',
    };
  }

  // 3. Check if auto-update is enabled
  if (skillsConfig.autoUpdate === false) {
    return {
      updated: [],
      skipped: true,
      reason: 'Skills auto-update is disabled',
    };
  }

  // 4. Get list of skills to install
  const skillsToInstall = skillsConfig.installed || [];
  if (skillsToInstall.length === 0) {
    return {
      updated: [],
      skipped: true,
      reason: 'No skills listed in skills.installed',
    };
  }

  // 5. Create skills directory
  const skillsDir = path.join(projectDir, LOCAL_SKILLS_DIR);
  fs.mkdirSync(skillsDir, { recursive: true });

  // 6. Download each skill
  const updated: string[] = [];
  for (const skillName of skillsToInstall) {
    if (verbose) {
      console.log(`  Syncing skill: ${skillName}`);
    }

    const skillTargetDir = path.join(skillsDir, skillName);

    // Remove existing skill directory
    if (fs.existsSync(skillTargetDir)) {
      fs.rmSync(skillTargetDir, { recursive: true });
    }

    fs.mkdirSync(skillTargetDir, { recursive: true });

    try {
      await downloadSkillDirectory(skillName, skillTargetDir);
      updated.push(skillName);
    } catch (err) {
      if (verbose) {
        console.error(
          `  Warning: Failed to sync skill '${skillName}':`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  return {
    updated,
    skipped: false,
  };
}
