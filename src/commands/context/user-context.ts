import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runGit, type GitRunner} from '../apps/git/run-git.js';
import {createPlatformContextApi, type ContextScope, type PlatformContextApi} from './platform-context.js';

/**
 * The user's agent context clone (docs/plans/agent-context.md in bkper-clients): AGENTS.md and `.agents/skills`, shared
 * with all of the user's agents. A push publishes; a pull brings what others published.
 */
export const USER_CONTEXT_SCOPE: ContextScope = 'user';
/**
 * Where agent context clones live on every machine, one folder per scope, as in the sandbox (whose home is `/workspace`):
 * `~/.bkper/domain`, `~/.bkper/user`, `~/.bkper/books/<bookId>`.
 */
export function getContextRoot(home: string = os.homedir()): string {
    return path.join(home, '.bkper');
}
export function getUserContextDir(home: string = os.homedir()): string {
    return path.join(getContextRoot(home), USER_CONTEXT_SCOPE);
}

/** synced; unpublished (nothing pushed yet: the clone is ready to push); unpushed (left as it is); failed. */
export type PullOutcome = 'synced' | 'unpublished' | 'unpushed' | 'failed';

/** The Git credential helper for a context scope; Git appends get, store or erase. */
export function buildContextCredentialHelperCommand(scope: string): string {
    return `!bkper context git-credential '${scope.replace(/'/g, `'\\''`)}'`;
}

export interface PullOptions {
    dir?: string;
    api?: PlatformContextApi;
    runner?: GitRunner;
}

/** Abort a stalled transfer instead of keeping a background pull alive. */
const STALL_ENV = {GIT_HTTP_LOW_SPEED_LIMIT: '1000', GIT_HTTP_LOW_SPEED_TIME: '30'};

async function succeeds(runner: GitRunner, args: string[], cwd: string): Promise<boolean> {
    return (await runner(args, {cwd, allowFailure: true})).exitCode === 0;
}

/** Whether the clone has changes not pushed: files not committed, or commits not on origin/main. */
async function unpushed(runner: GitRunner, cwd: string): Promise<boolean> {
    if ((await runner(['status', '--porcelain'], {cwd})).stdout) return true;
    if (!(await succeeds(runner, ['rev-parse', '-q', '--verify', 'HEAD'], cwd))) return false;
    if (!(await succeeds(runner, ['rev-parse', '-q', '--verify', 'refs/remotes/origin/main'], cwd))) return true;
    return Boolean((await runner(['rev-list', '-n', '1', 'refs/remotes/origin/main..HEAD'], {cwd})).stdout);
}

/** A clone of the scope's `remote` in `dir`, tracking main, whose credentials come only from the helper (never stored). */
async function prepare(runner: GitRunner, dir: string, remote: string, scope: ContextScope): Promise<void> {
    fs.mkdirSync(dir, {recursive: true});
    if (!fs.existsSync(path.join(dir, '.git'))) {
        await runner(['init', '-q', '-b', 'main'], {cwd: dir});
        await runner(['remote', 'add', 'origin', remote], {cwd: dir});
        await runner(['config', 'branch.main.remote', 'origin'], {cwd: dir});
        await runner(['config', 'branch.main.merge', 'refs/heads/main'], {cwd: dir});
    }
    await runner(['remote', 'set-url', 'origin', remote], {cwd: dir});
    const key = `credential.${remote.replace(/\/+$/, '')}`;
    await runner(['config', `${key}.useHttpPath`, 'true'], {cwd: dir});
    // Clears inherited helpers for this remote, then pins the context helper.
    await runner(['config', '--replace-all', `${key}.helper`, ''], {cwd: dir});
    await runner(['config', '--add', `${key}.helper`, buildContextCredentialHelperCommand(scope)], {
        cwd: dir,
    });
}

/**
 * Bring a scope's clone in `dir` up to date with what is published, fast-forward only: creates it if needed (ready to push
 * even before anything was published), and leaves a clone with unpushed changes as it is. `configure` runs once the clone
 * exists, before fetching. Platform's refusal (no access, no login) throws before anything is created.
 */
export async function syncContextClone(
    scope: ContextScope,
    dir: string,
    options: Omit<PullOptions, 'dir'> & {configure?: (runner: GitRunner, dir: string) => Promise<void>} = {}
): Promise<PullOutcome> {
    const runner = options.runner ?? runGit;
    const credential = await (options.api ?? createPlatformContextApi()).issueCredential('read', scope);
    await prepare(runner, dir, credential.remote, scope);
    await options.configure?.(runner, dir);
    if (!('token' in credential)) return 'unpublished';
    try {
        // The helper answers this fetch with the read token issued above, from the environment only.
        const fetched = await runner(['fetch', '-q', 'origin'], {
            cwd: dir,
            allowFailure: true,
            env: {...STALL_ENV, BKPER_CONTEXT_TOKEN: credential.token, BKPER_CONTEXT_REMOTE: credential.remote},
        });
        if (fetched.exitCode !== 0) return 'failed';
        if (!(await succeeds(runner, ['rev-parse', '-q', '--verify', 'refs/remotes/origin/main'], dir))) {
            return 'unpublished';
        }
        if (await unpushed(runner, dir)) return 'unpushed';
        return (await succeeds(runner, ['merge', '-q', '--ff-only', 'refs/remotes/origin/main'], dir))
            ? 'synced'
            : 'failed';
    } catch {
        return 'failed';
    }
}

/**
 * Bring the user's context clone up to date with what is published, fast-forward only: creates it if needed (ready to
 * push even before anything was published), and leaves a clone with unpushed changes as it is. Never throws.
 */
export async function pullUserContext(options: PullOptions = {}): Promise<PullOutcome> {
    try {
        return await syncContextClone(USER_CONTEXT_SCOPE, options.dir ?? getUserContextDir(), options);
    } catch {
        return 'failed';
    }
}
