import {spawnSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function makeTempDir(prefix = 'bkper-git-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function runGitSync(
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv = {}
): {stdout: string; stderr: string; status: number | null} {
    const result = spawnSync('git', args, {
        cwd,
        env: {
            ...process.env,
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_TERMINAL_PROMPT: '0',
            ...env,
        },
        encoding: 'utf8',
    });
    return {
        stdout: (result.stdout ?? '').toString(),
        stderr: (result.stderr ?? '').toString(),
        status: result.status,
    };
}

export function initRepo(dir: string, branch = 'main'): void {
    fs.mkdirSync(dir, {recursive: true});
    const init = runGitSync(['init', '-b', branch], dir);
    if (init.status !== 0) {
        // Fallback for older git without -b
        runGitSync(['init'], dir);
        runGitSync(['checkout', '-b', branch], dir);
    }
    runGitSync(['config', 'user.email', 'test@example.com'], dir);
    runGitSync(['config', 'user.name', 'Test User'], dir);
    runGitSync(['config', 'commit.gpgsign', 'false'], dir);
}

export function writeFile(repoDir: string, relativePath: string, content: string): void {
    const fullPath = path.join(repoDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), {recursive: true});
    fs.writeFileSync(fullPath, content, 'utf8');
}

export function commitAll(repoDir: string, message: string): string {
    runGitSync(['add', '.'], repoDir);
    const commit = runGitSync(['commit', '-m', message], repoDir);
    if (commit.status !== 0) {
        throw new Error(`commit failed: ${commit.stderr || commit.stdout}`);
    }
    const sha = runGitSync(['rev-parse', 'HEAD'], repoDir);
    return sha.stdout.trim();
}

export function createBareRemote(): string {
    const dir = makeTempDir('bkper-bare-');
    runGitSync(['init', '--bare', '-b', 'main'], dir);
    return dir;
}

export const ARTIFACTS_REMOTE =
    'https://example.artifacts.cloudflare.net/git/bkper-app-sources-dev/demo-app.git';
