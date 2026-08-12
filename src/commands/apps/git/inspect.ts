import fs from 'fs';
import path from 'path';
import {runGit, type GitRunner} from './run-git.js';
import {
    ARTIFACTS_HOST_SUFFIX,
    ManagedGitError,
    type GitRemote,
    type GitRepositoryInfo,
    type WorkingTreeStatus,
} from './types.js';

export function isArtifactsRemoteUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            return false;
        }
        return (
            parsed.hostname === 'artifacts.cloudflare.net' ||
            parsed.hostname.endsWith(ARTIFACTS_HOST_SUFFIX)
        );
    } catch {
        // SCP-like or malformed URLs are never Artifacts HTTPS remotes.
        return false;
    }
}

export function normalizeRemoteUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

export function remoteUrlsEqual(left: string, right: string): boolean {
    return normalizeRemoteUrl(left) === normalizeRemoteUrl(right);
}

/**
 * Resolves the Git repository root for a path, or null when outside a repo.
 */
export async function findGitRoot(
    startDir: string,
    runner: GitRunner = runGit
): Promise<string | null> {
    const result = await runner(['rev-parse', '--show-toplevel'], {
        cwd: startDir,
        allowFailure: true,
    });
    if (result.exitCode !== 0) {
        return null;
    }
    const root = result.stdout.trim();
    return root ? path.resolve(root) : null;
}

export function findBkperYaml(dir: string): string | null {
    const yamlPath = path.join(dir, 'bkper.yaml');
    if (fs.existsSync(yamlPath)) {
        return yamlPath;
    }
    const jsonPath = path.join(dir, 'bkper.json');
    if (fs.existsSync(jsonPath)) {
        return jsonPath;
    }
    return null;
}

export async function listRemotes(
    repoRoot: string,
    runner: GitRunner = runGit
): Promise<GitRemote[]> {
    const result = await runner(['remote', '-v'], {
        cwd: repoRoot,
        allowFailure: true,
    });
    if (result.exitCode !== 0 || !result.stdout.trim()) {
        return [];
    }

    const byName = new Map<string, GitRemote>();
    for (const line of result.stdout.split('\n')) {
        const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim());
        if (!match) {
            continue;
        }
        const [, name, url] = match;
        if (!byName.has(name)) {
            byName.set(name, {
                name,
                url,
                isArtifacts: isArtifactsRemoteUrl(url),
            });
        }
    }
    return [...byName.values()];
}

export function hasExternalRemote(remotes: GitRemote[]): boolean {
    return remotes.some(remote => !remote.isArtifacts);
}

export function getOriginRemote(remotes: GitRemote[]): GitRemote | undefined {
    return remotes.find(remote => remote.name === 'origin');
}

export async function getCurrentBranch(
    repoRoot: string,
    runner: GitRunner = runGit
): Promise<{branch: string | null; detached: boolean}> {
    const symbolic = await runner(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
        cwd: repoRoot,
        allowFailure: true,
    });
    if (symbolic.exitCode === 0 && symbolic.stdout.trim()) {
        return {branch: symbolic.stdout.trim(), detached: false};
    }
    return {branch: null, detached: true};
}

export async function getHeadSha(
    repoRoot: string,
    runner: GitRunner = runGit
): Promise<string | null> {
    const result = await runner(['rev-parse', '--verify', 'HEAD'], {
        cwd: repoRoot,
        allowFailure: true,
    });
    if (result.exitCode !== 0) {
        return null;
    }
    const sha = result.stdout.trim();
    return sha || null;
}

export async function getWorkingTreeStatus(
    repoRoot: string,
    runner: GitRunner = runGit
): Promise<WorkingTreeStatus> {
    const result = await runner(['status', '--porcelain=v1', '-uall'], {
        cwd: repoRoot,
    });
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    for (const line of result.stdout.split('\n')) {
        if (!line) {
            continue;
        }
        const indexStatus = line[0] ?? ' ';
        const workTreeStatus = line[1] ?? ' ';
        const filePath = line.slice(3).trim();
        if (!filePath) {
            continue;
        }

        if (indexStatus === '?' && workTreeStatus === '?') {
            untracked.push(filePath);
            continue;
        }
        if (indexStatus !== ' ' && indexStatus !== '?') {
            staged.push(filePath);
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
            modified.push(filePath);
        }
    }

    return {
        clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
        staged,
        modified,
        untracked,
    };
}

/**
 * Inspects the Git repository surrounding an app directory.
 */
export async function inspectGitRepository(
    appDir: string,
    runner: GitRunner = runGit
): Promise<GitRepositoryInfo | null> {
    const root = await findGitRoot(appDir, runner);
    if (!root) {
        return null;
    }

    const bkperYamlPath = findBkperYaml(appDir);
    const resolvedAppDir = path.resolve(appDir);
    const isNestedApp =
        bkperYamlPath !== null && path.resolve(path.dirname(bkperYamlPath)) !== root;

    const [{branch, detached}, head, remotes] = await Promise.all([
        getCurrentBranch(root, runner),
        getHeadSha(root, runner),
        listRemotes(root, runner),
    ]);

    return {
        root,
        branch,
        head,
        detached,
        hasCommits: head !== null,
        remotes,
        isNestedApp,
        bkperYamlPath,
    };
}

export async function ensureGitInitialized(
    targetDir: string,
    runner: GitRunner = runGit
): Promise<boolean> {
    const existingRoot = await findGitRoot(targetDir, runner);
    if (existingRoot) {
        return false;
    }
    await runner(['init', '-b', 'main'], {cwd: targetDir});
    return true;
}

export function requireGitRepository(
    info: GitRepositoryInfo | null
): asserts info is GitRepositoryInfo {
    if (!info) {
        throw new ManagedGitError(
            'NO_GIT_REPOSITORY',
            [
                'No Git repository found for this App.',
                'Initialize one at the App root, for example:',
                '  git init -b main',
                '  git add .',
                '  git commit -m "Initial app"',
            ].join('\n')
        );
    }
}
