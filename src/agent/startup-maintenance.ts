import {
    getAvailableUpgrade,
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
    startDetachedUpgrade: (method: InstallMethod, version: string) => void;
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        getAvailableUpgrade,
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
