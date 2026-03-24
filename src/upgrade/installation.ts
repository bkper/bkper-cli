import { exec, execSync, spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

/** Current installed version of the CLI. */
export const VERSION: string = pkg.version;

/** Package name on npm. */
const PACKAGE_NAME = 'bkper';

/** Supported installation methods. */
export type InstallMethod = 'npm' | 'bun' | 'yarn' | 'unknown';

export type CommandRunner = (command: string, timeoutMs: number) => Promise<string>;
export type DetachedCommandStarter = (command: string) => void;

const defaultCommandRunner: CommandRunner = (command, timeoutMs) => {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
};

const defaultDetachedCommandStarter: DetachedCommandStarter = command => {
    const child = spawn(command, [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });
    child.unref();
};

function getLatestVersionOverride(): string | undefined {
    return process.env.BKPER_AUTOUPDATE_LATEST_VERSION || undefined;
}

function getUpgradeCommandOverride(): string | undefined {
    return process.env.BKPER_AUTOUPDATE_COMMAND || undefined;
}

function getDetectionChecks(): Array<{ method: InstallMethod; command: string }> {
    return [
        { method: 'bun', command: 'bun pm ls -g' },
        { method: 'npm', command: `npm list -g ${PACKAGE_NAME} --depth=0` },
        { method: 'yarn', command: 'yarn global list --depth=0' },
    ];
}

/**
 * Detects how the CLI was installed by checking global package lists
 * for each supported package manager.
 */
export function detectMethod(): InstallMethod {
    for (const { method, command } of getDetectionChecks()) {
        try {
            const output = execSync(command, {
                encoding: 'utf-8',
                timeout: 10000,
                stdio: ['ignore', 'pipe', 'ignore'],
                windowsHide: true,
            });
            if (output.includes(PACKAGE_NAME)) {
                return method;
            }
        } catch {
            // Package manager not available or command failed — try next
        }
    }

    return 'unknown';
}

/**
 * Async version of installation method detection to avoid blocking the event loop.
 */
export async function detectMethodAsync(
    commandRunner: CommandRunner = defaultCommandRunner
): Promise<InstallMethod> {
    for (const { method, command } of getDetectionChecks()) {
        try {
            const output = await commandRunner(command, 10000);
            if (output.includes(PACKAGE_NAME)) {
                return method;
            }
        } catch {
            // Package manager not available or command failed — try next
        }
    }

    return 'unknown';
}

/**
 * Fetches the latest published version from the npm registry.
 * Returns null if the fetch fails.
 */
export async function fetchLatestVersion(): Promise<string | null> {
    const latestVersionOverride = getLatestVersionOverride();
    if (latestVersionOverride) {
        return latestVersionOverride;
    }

    try {
        const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { version?: string };
        return data.version ?? null;
    } catch {
        return null;
    }
}

/**
 * Returns the shell command to upgrade the CLI for a given install method and version.
 */
export function getUpgradeCommand(method: InstallMethod, version: string): string | null {
    switch (method) {
        case 'npm':
            return `npm install -g ${PACKAGE_NAME}@${version}`;
        case 'bun':
            return `bun add -g ${PACKAGE_NAME}@${version}`;
        case 'yarn':
            return `yarn global add ${PACKAGE_NAME}@${version}`;
        default:
            return null;
    }
}

/**
 * Executes the upgrade to the specified version using the given install method.
 * Throws if the upgrade command fails.
 */
export function executeUpgrade(method: InstallMethod, version: string): void {
    const command = getUpgradeCommand(method, version);
    if (!command) {
        throw new Error(
            `Unable to auto-upgrade: unknown installation method. ` +
                `Please upgrade manually: npm install -g ${PACKAGE_NAME}@${version}`
        );
    }
    execSync(command, { stdio: 'pipe', timeout: 60000, windowsHide: true });
}

/**
 * Starts the upgrade in a detached background process.
 */
export function startDetachedUpgrade(
    method: InstallMethod,
    version: string,
    commandStarter: DetachedCommandStarter = defaultDetachedCommandStarter
): void {
    const command = getUpgradeCommandOverride() ?? getUpgradeCommand(method, version);
    if (!command) {
        throw new Error(
            `Unable to auto-upgrade: unknown installation method. ` +
                `Please upgrade manually: npm install -g ${PACKAGE_NAME}@${version}`
        );
    }

    commandStarter(command);
}
