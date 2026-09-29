import { spawn } from 'child_process';
import { createHash } from 'crypto';
import {
    closeSync,
    mkdirSync,
    openSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BKPER_CONFIG_DIR } from '../dev/cloudflared/constants.js';
import {
    PACKAGE_DIR,
    VERSION,
    fetchLatestVersion,
    getSelfUpdatePlan,
    readInstalledVersion,
    runInstallCommand,
} from './installation.js';
import type { SelfUpdatePlan } from './installation.js';
import { isNewerVersion } from './upgrade.js';

/** At most one npm check (and install attempt) per installed copy per day. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const REGISTRY_TIMEOUT_MS = 3000;
const STALE_LOCK_MS = 5000;

export interface InstallRecord {
    version: string;
    status: 'installed' | 'manual' | 'failed';
    instruction?: string;
}

export interface UpdateCheckState {
    lastAttemptedAt?: number;
    latestVersion?: string;
    install?: InstallRecord;
}

export type UpdateNotice =
    | { kind: 'installed'; current: string; latest: string }
    | { kind: 'manual'; current: string; latest: string; instruction: string };

type Env = Record<string, string | undefined>;

/**
 * Cache file for one installed copy. Copies (e.g. npm and bun) keep separate
 * state so each one only ever updates itself.
 */
export function getUpdateCachePath(
    packageDir: string = PACKAGE_DIR,
    configDir: string = BKPER_CONFIG_DIR
): string {
    const key = createHash('sha256').update(packageDir).digest('hex').slice(0, 16);
    return path.join(configDir, 'update-check', `${key}.json`);
}

export function isUpdateCheckDisabled(env: Env = process.env): boolean {
    if (env.BKPER_DISABLE_AUTOUPDATE) {
        return true;
    }
    const ci = env.CI?.trim().toLowerCase();
    return !!ci && ci !== '0' && ci !== 'false';
}

export function readUpdateState(cachePath: string = getUpdateCachePath()): UpdateCheckState {
    try {
        const data: unknown = JSON.parse(readFileSync(cachePath, 'utf8'));
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return {};
        }
        const record = data as Record<string, unknown>;
        const state: UpdateCheckState = {};
        if (typeof record.lastAttemptedAt === 'number') {
            state.lastAttemptedAt = record.lastAttemptedAt;
        }
        if (typeof record.latestVersion === 'string') {
            state.latestVersion = record.latestVersion;
        }
        const install = record.install as Record<string, unknown> | undefined;
        if (
            install &&
            typeof install.version === 'string' &&
            (install.status === 'installed' ||
                install.status === 'manual' ||
                install.status === 'failed')
        ) {
            state.install = { version: install.version, status: install.status };
            if (typeof install.instruction === 'string') {
                state.install.instruction = install.instruction;
            }
        }
        return state;
    } catch {
        return {};
    }
}

/** Writes the state atomically (temp file + rename). */
export function writeUpdateState(
    state: UpdateCheckState,
    cachePath: string = getUpdateCachePath()
): boolean {
    const tempPath = `${cachePath}.${process.pid}.tmp`;
    try {
        mkdirSync(path.dirname(cachePath), { recursive: true });
        writeFileSync(tempPath, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
        renameSync(tempPath, cachePath);
        return true;
    } catch {
        try {
            unlinkSync(tempPath);
        } catch {
            // Nothing to clean up
        }
        return false;
    }
}

function withLock<T>(cachePath: string, fn: () => T): T | undefined {
    const lockPath = `${cachePath}.lock`;
    let fd: number | undefined;
    try {
        mkdirSync(path.dirname(cachePath), { recursive: true });
        try {
            fd = openSync(lockPath, 'wx', 0o600);
        } catch {
            if (Date.now() - statSync(lockPath).mtimeMs <= STALE_LOCK_MS) {
                return undefined;
            }
            unlinkSync(lockPath);
            fd = openSync(lockPath, 'wx', 0o600);
        }
        return fn();
    } catch {
        return undefined;
    } finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
                unlinkSync(lockPath);
            } catch {
                // Lock goes stale on its own
            }
        }
    }
}

function spawnUpdateWorker(): void {
    const isTypeScript = import.meta.url.endsWith('.ts');
    const workerPath = fileURLToPath(
        new URL(isTypeScript ? './update-worker.ts' : './update-worker.js', import.meta.url)
    );
    const args = isTypeScript ? [...process.execArgv, workerPath] : [workerPath];
    spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

export interface StartUpdateCheckOptions {
    cachePath?: string;
    now?: number;
    env?: Env;
    spawnWorker?: () => void;
}

/**
 * Starts the detached update worker when the last attempt is older than a day.
 * Never blocks the running command and never installs in this process.
 */
export function maybeStartUpdateCheck(options: StartUpdateCheckOptions = {}): boolean {
    const cachePath = options.cachePath ?? getUpdateCachePath();
    const now = options.now ?? Date.now();
    if (isUpdateCheckDisabled(options.env ?? process.env)) {
        return false;
    }

    const claimed = withLock(cachePath, () => {
        const state = readUpdateState(cachePath);
        if (state.lastAttemptedAt !== undefined && now - state.lastAttemptedAt < CHECK_INTERVAL_MS) {
            return false;
        }
        return writeUpdateState({ ...state, lastAttemptedAt: now }, cachePath);
    });
    if (!claimed) {
        return false;
    }

    try {
        (options.spawnWorker ?? spawnUpdateWorker)();
        return true;
    } catch {
        return false;
    }
}

export interface UpdateWorkerDependencies {
    cachePath: string;
    version: string;
    fetchLatestVersion: (timeoutMs: number) => Promise<string | null>;
    getSelfUpdatePlan: (version: string) => SelfUpdatePlan;
    runInstall: (command: string) => void;
    readInstalledVersion: (packageJsonPath: string) => string | undefined;
}

function createDefaultWorkerDependencies(): UpdateWorkerDependencies {
    return {
        cachePath: getUpdateCachePath(),
        version: VERSION,
        fetchLatestVersion,
        getSelfUpdatePlan: version => getSelfUpdatePlan(version),
        runInstall: runInstallCommand,
        readInstalledVersion,
    };
}

function decideInstall(latest: string, deps: UpdateWorkerDependencies): InstallRecord {
    const plan = deps.getSelfUpdatePlan(latest);
    if (plan.kind === 'manual') {
        return { version: latest, status: 'manual', instruction: plan.instruction };
    }
    if (deps.readInstalledVersion(plan.packageJsonPath) === latest) {
        return { version: latest, status: 'installed' };
    }
    try {
        deps.runInstall(plan.command);
    } catch {
        return { version: latest, status: 'failed' };
    }
    const installed = deps.readInstalledVersion(plan.packageJsonPath);
    return { version: latest, status: installed === latest ? 'installed' : 'failed' };
}

/**
 * Detached worker: checks npm and installs a newer version into the running
 * copy only when that copy is a verified, writable global install.
 */
export async function runUpdateWorker(
    deps: UpdateWorkerDependencies = createDefaultWorkerDependencies()
): Promise<void> {
    try {
        const latest = await deps.fetchLatestVersion(REGISTRY_TIMEOUT_MS);
        if (!latest) {
            return;
        }
        writeUpdateState({ ...readUpdateState(deps.cachePath), latestVersion: latest }, deps.cachePath);
        if (!isNewerVersion(deps.version, latest)) {
            return;
        }
        const install = decideInstall(latest, deps);
        writeUpdateState({ ...readUpdateState(deps.cachePath), install }, deps.cachePath);
    } catch {
        // Never surface worker errors
    }
}

/**
 * Reads what the running copy should tell the user, based on the cache only.
 */
export function getUpdateNotice(
    state: UpdateCheckState,
    currentVersion: string = VERSION
): UpdateNotice | undefined {
    const latest = state.latestVersion;
    if (!latest || !isNewerVersion(currentVersion, latest)) {
        return undefined;
    }
    const install = state.install;
    if (!install || install.version !== latest) {
        return undefined;
    }
    if (install.status === 'installed') {
        return { kind: 'installed', current: currentVersion, latest };
    }
    return {
        kind: 'manual',
        current: currentVersion,
        latest,
        instruction: install.instruction ?? 'Run: bkper upgrade',
    };
}

export function formatUpdateNotice(notice: UpdateNotice): string {
    if (notice.kind === 'installed') {
        return `bkper ${notice.latest} installed (current ${notice.current}). Restart to use it.`;
    }
    return `bkper ${notice.latest} available (current ${notice.current}). ${notice.instruction}`;
}

/**
 * Plain-command hook: prints the fallback warning when the copy cannot
 * update itself, then starts the daily background check.
 */
export function runCommandUpdateCheck(
    writeStderr: (message: string) => void = message => process.stderr.write(message)
): void {
    try {
        if (isUpdateCheckDisabled()) {
            return;
        }
        const notice = getUpdateNotice(readUpdateState());
        if (notice?.kind === 'manual') {
            writeStderr(`${formatUpdateNotice(notice)}\n`);
        }
        maybeStartUpdateCheck();
    } catch {
        // Never break the user's command
    }
}
