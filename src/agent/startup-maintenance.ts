import {
    formatUpdateNotice,
    getUpdateNotice,
    isUpdateCheckDisabled,
    maybeStartUpdateCheck,
    readUpdateState,
    type UpdateNotice,
} from '../upgrade/index.js';

type NotificationType = 'info' | 'warning' | 'error';

export interface StartupMaintenanceCallbacks {
    notify: (message: string, type?: NotificationType) => void;
}

export interface StartupMaintenanceDependencies {
    readNotice: () => UpdateNotice | undefined;
    startUpdateCheck: () => boolean;
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        readNotice: () => getUpdateNotice(readUpdateState()),
        startUpdateCheck: () => maybeStartUpdateCheck(),
    };
}

/**
 * Reports the outcome of the last background update and starts the daily
 * check. The install itself runs in the detached update worker.
 */
export async function runStartupMaintenance(
    callbacks: StartupMaintenanceCallbacks,
    dependencies: StartupMaintenanceDependencies = createDefaultDependencies()
): Promise<void> {
    if (isUpdateCheckDisabled()) {
        return;
    }

    try {
        const notice = dependencies.readNotice();
        if (notice) {
            callbacks.notify(
                formatUpdateNotice(notice),
                notice.kind === 'installed' ? 'info' : 'warning'
            );
        }
        dependencies.startUpdateCheck();
    } catch {
        // Silent failure — never break the TUI
    }
}
