import {
    getAvailableUpgrade,
    isVersionInstalledAsync,
    startDetachedUpgrade,
    type AvailableUpgrade,
    type InstallMethod,
} from '../upgrade/index.js';

type NotificationType = 'info' | 'warning' | 'error';

export interface StartupMaintenanceCallbacks {
    notify: (message: string, type?: NotificationType) => void;
}

export interface StartupMaintenanceDependencies {
    getAvailableUpgrade: () => Promise<AvailableUpgrade | null>;
    isVersionInstalled: (method: InstallMethod, version: string) => Promise<boolean>;
    startDetachedUpgrade: (method: InstallMethod, version: string) => void;
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        getAvailableUpgrade,
        isVersionInstalled: isVersionInstalledAsync,
        startDetachedUpgrade,
    };
}

function getManualUpgradeMessage(latest: string): string {
    return `bkper ${latest} available. Run bkper upgrade after exit.`;
}

export async function runStartupMaintenance(
    callbacks: StartupMaintenanceCallbacks,
    dependencies: StartupMaintenanceDependencies = createDefaultDependencies()
): Promise<void> {
    if (process.env.BKPER_DISABLE_AUTOUPDATE) {
        return;
    }

    try {
        const availableUpgrade = await dependencies.getAvailableUpgrade();
        if (!availableUpgrade) {
            return;
        }

        if (availableUpgrade.method === 'unknown') {
            callbacks.notify(getManualUpgradeMessage(availableUpgrade.latest), 'warning');
            return;
        }

        if (
            await dependencies.isVersionInstalled(
                availableUpgrade.method,
                availableUpgrade.latest
            )
        ) {
            callbacks.notify(
                `bkper ${availableUpgrade.latest} is already installed. ` +
                    `Restart this session to use it.`,
                'info'
            );
            return;
        }

        try {
            dependencies.startDetachedUpgrade(availableUpgrade.method, availableUpgrade.latest);
            callbacks.notify(
                `Updating bkper to ${availableUpgrade.latest} in background. ` +
                    `Restart later to use it.`,
                'info'
            );
        } catch {
            callbacks.notify(getManualUpgradeMessage(availableUpgrade.latest), 'warning');
        }
    } catch {
        // Silent failure — never break the TUI
    }
}
