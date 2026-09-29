import {
    VERSION,
    fetchLatestVersion,
    getSelfUpdatePlan,
    readInstalledVersion,
    runInstallCommand,
} from './installation.js';
import type { SelfUpdatePlan } from './installation.js';

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

export interface UpgradeDependencies {
    version: string;
    fetchLatestVersion: () => Promise<string | null>;
    getSelfUpdatePlan: (version: string) => SelfUpdatePlan;
    runInstall: (command: string) => void;
    readInstalledVersion: (packageJsonPath: string) => string | undefined;
    log: (message: string) => void;
    error: (message: string) => void;
}

function createDefaultUpgradeDependencies(): UpgradeDependencies {
    return {
        version: VERSION,
        fetchLatestVersion: () => fetchLatestVersion(),
        getSelfUpdatePlan: version => getSelfUpdatePlan(version),
        runInstall: runInstallCommand,
        readInstalledVersion,
        log: message => console.log(message),
        error: message => console.error(message),
    };
}

/**
 * Upgrades the running copy of bkper and returns the process exit code.
 * Refuses to touch anything that is not a verified, writable global install.
 */
export async function runUpgrade(
    targetVersion: string | undefined,
    deps: UpgradeDependencies = createDefaultUpgradeDependencies()
): Promise<number> {
    const latest = targetVersion ?? (await deps.fetchLatestVersion());
    if (!latest) {
        deps.error('Could not determine the latest version. Check your network connection.');
        return 1;
    }

    if (!targetVersion && !isNewerVersion(deps.version, latest)) {
        deps.log(`Already on the latest version (${deps.version}).`);
        return 0;
    }

    const plan = deps.getSelfUpdatePlan(latest);
    if (plan.kind === 'manual') {
        deps.error(
            `Cannot upgrade this bkper automatically.\n` +
                `Running bkper: ${plan.packageDir}\n` +
                `Detected method: ${plan.method}\n` +
                plan.instruction
        );
        return 1;
    }

    deps.log(`Upgrading bkper: ${deps.version} \u2192 ${latest}`);
    deps.log(`Running: ${plan.command}`);

    try {
        deps.runInstall(plan.command);
    } catch (err) {
        deps.error(`Upgrade failed: ${err instanceof Error ? err.message : String(err)}`);
        deps.error(`Try upgrading manually: ${plan.command}`);
        return 1;
    }

    const installed = deps.readInstalledVersion(plan.packageJsonPath);
    if (installed !== latest) {
        deps.error(
            `bkper@${latest} was installed elsewhere; the running bkper at ${plan.packageDir} ` +
                `is still ${installed ?? 'unknown'}.\n` +
                `Update it with the package manager that provides it.`
        );
        return 1;
    }

    deps.log(`Successfully upgraded to bkper@${latest}. Restart your terminal to use the new version.`);
    return 0;
}

/**
 * Runs an explicit foreground upgrade with user-facing output.
 * Used by the `bkper upgrade` command.
 */
export async function foregroundUpgrade(targetVersion?: string): Promise<void> {
    const exitCode = await runUpgrade(targetVersion);
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
