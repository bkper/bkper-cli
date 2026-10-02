import {
    AGENT_CHECK_INTERVAL_MS,
    formatUpdateNotice,
    getUpdateNotice,
    isUpdateCheckDisabled,
    maybeStartUpdateCheck,
    readUpdateState,
    type StartUpdateCheckOptions,
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

/**
 * Unlike plain commands (once a day), interactive sessions check on every
 * start, so new releases are picked up by the next session.
 */
export function startAgentUpdateCheck(options: StartUpdateCheckOptions = {}): boolean {
    return maybeStartUpdateCheck({...options, intervalMs: AGENT_CHECK_INTERVAL_MS});
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        readNotice: () => getUpdateNotice(readUpdateState()),
        startUpdateCheck: () => startAgentUpdateCheck(),
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
