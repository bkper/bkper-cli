import {
    VERSION,
    fetchLatestVersion,
    detectMethod,
    detectMethodAsync,
    executeUpgrade,
    getUpgradeCommand,
    startDetachedUpgrade,
} from './installation.js';
import type { InstallMethod } from './installation.js';

/**
 * Compares two semver version strings.
 * Returns true if `latest` is newer than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
    const parse = (v: string) => v.split('.').map(Number);
    const [cMajor, cMinor, cPatch] = parse(current);
    const [lMajor, lMinor, lPatch] = parse(latest);

    if (lMajor !== cMajor) return lMajor > cMajor;
    if (lMinor !== cMinor) return lMinor > cMinor;
    return lPatch > cPatch;
}

export interface AvailableUpgrade {
    current: string;
    latest: string;
    method: InstallMethod;
}

export interface AvailableUpgradeDependencies {
    version: string;
    fetchLatestVersion: () => Promise<string | null>;
    detectMethod: () => Promise<InstallMethod>;
}

export interface AutoUpgradeDependencies extends AvailableUpgradeDependencies {
    startUpgrade: (method: InstallMethod, version: string) => void;
    writeStderr: (message: string) => void;
}

function writeAutoUpgradeMessage(message: string): void {
    if (process.stdout.isTTY === true && process.stderr.isTTY === true) {
        return;
    }
    process.stderr.write(message);
}

function createDefaultAvailableUpgradeDependencies(): AvailableUpgradeDependencies {
    return {
        version: VERSION,
        fetchLatestVersion,
        detectMethod: detectMethodAsync,
    };
}

function createDefaultAutoUpgradeDependencies(): AutoUpgradeDependencies {
    return {
        ...createDefaultAvailableUpgradeDependencies(),
        startUpgrade: startDetachedUpgrade,
        writeStderr: writeAutoUpgradeMessage,
    };
}

function getManualUpgradeMessage(current: string, latest: string): string {
    return (
        `\nbkper ${latest} available (current: ${current}). ` +
        `Upgrade manually: npm install -g bkper@${latest}\n`
    );
}

/**
 * Checks whether a newer version is available and returns the target version
 * plus the detected install method.
 */
export async function getAvailableUpgrade(
    dependencies: AvailableUpgradeDependencies = createDefaultAvailableUpgradeDependencies()
): Promise<AvailableUpgrade | null> {
    const latest = await dependencies.fetchLatestVersion();
    if (!latest) return null;
    if (!isNewerVersion(dependencies.version, latest)) return null;

    const method = await dependencies.detectMethod();
    return {
        current: dependencies.version,
        latest,
        method,
    };
}

/**
 * Runs the silent auto-upgrade check in the background.
 *
 * Called on every CLI invocation. This function:
 * 1. Fetches the latest version from npm
 * 2. Compares with the current installed version
 * 3. If newer, starts a detached background upgrade using the detected install method
 * 4. Prints a brief message to stderr on fallback or when running non-interactively
 *
 * All errors are swallowed silently to never disrupt the user's command.
 */
export async function autoUpgrade(
    dependencies: AutoUpgradeDependencies = createDefaultAutoUpgradeDependencies()
): Promise<void> {
    try {
        const availableUpgrade = await getAvailableUpgrade(dependencies);
        if (!availableUpgrade) return;

        if (availableUpgrade.method === 'unknown') {
            dependencies.writeStderr(
                getManualUpgradeMessage(availableUpgrade.current, availableUpgrade.latest)
            );
            return;
        }

        try {
            dependencies.startUpgrade(availableUpgrade.method, availableUpgrade.latest);
            dependencies.writeStderr(
                `\nbkper update started in background: ` +
                    `${availableUpgrade.current} \u2192 ${availableUpgrade.latest} ` +
                    `(restart later to use)\n`
            );
        } catch {
            dependencies.writeStderr(
                getManualUpgradeMessage(availableUpgrade.current, availableUpgrade.latest)
            );
        }
    } catch {
        // Silent failure — never break the user's command
    }
}

/**
 * Runs an explicit foreground upgrade with user-facing output.
 * Used by the `bkper upgrade` command.
 */
export async function foregroundUpgrade(
    targetVersion?: string,
    methodOverride?: string
): Promise<void> {
    const latest = targetVersion ?? (await fetchLatestVersion());
    if (!latest) {
        console.error('Could not determine the latest version. Check your network connection.');
        process.exit(1);
    }

    if (!isNewerVersion(VERSION, latest) && !targetVersion) {
        console.log(`Already on the latest version (${VERSION}).`);
        return;
    }

    const method: InstallMethod =
        methodOverride && isValidMethod(methodOverride) ? methodOverride : detectMethod();

    if (method === 'unknown') {
        console.error(
            `Could not detect how bkper was installed.\n` +
                `Please upgrade manually: npm install -g bkper@${latest}\n` +
                `Or specify the method: bkper upgrade --method npm`
        );
        process.exit(1);
    }

    const command = getUpgradeCommand(method, latest);
    console.log(`Upgrading bkper: ${VERSION} \u2192 ${latest}`);
    console.log(`Running: ${command}`);

    try {
        executeUpgrade(method, latest);
        console.log(
            `Successfully upgraded to bkper@${latest}. Restart your terminal to use the new version.`
        );
    } catch (err) {
        console.error(`Upgrade failed:`, err);
        console.error(`\nTry upgrading manually: ${command}`);
        process.exit(1);
    }
}

function isValidMethod(method: string): method is InstallMethod {
    return ['npm', 'bun', 'yarn'].includes(method);
}
