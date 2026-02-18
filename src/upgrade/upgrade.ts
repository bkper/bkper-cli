import {
    VERSION,
    fetchLatestVersion,
    detectMethod,
    executeUpgrade,
    getUpgradeCommand,
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

/**
 * Runs the silent auto-upgrade check in the background.
 *
 * Called on every CLI invocation. This function:
 * 1. Fetches the latest version from npm
 * 2. Compares with the current installed version
 * 3. If newer, silently upgrades using the detected install method
 * 4. Prints a brief message to stderr on success
 *
 * All errors are swallowed silently to never disrupt the user's command.
 */
export async function autoUpgrade(): Promise<void> {
    try {
        const latest = await fetchLatestVersion();
        if (!latest) return;
        if (!isNewerVersion(VERSION, latest)) return;

        const method = detectMethod();
        if (method === 'unknown') {
            // Can't auto-upgrade if we don't know how it was installed.
            // Print a hint to stderr so it doesn't pollute stdout.
            process.stderr.write(
                `\nbkper ${latest} available (current: ${VERSION}). ` +
                    `Upgrade manually: npm install -g bkper@${latest}\n`
            );
            return;
        }

        executeUpgrade(method, latest);
        process.stderr.write(`\nbkper upgraded: ${VERSION} \u2192 ${latest} (restart to use)\n`);
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
