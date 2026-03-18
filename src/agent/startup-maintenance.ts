import { autoUpgrade } from '../upgrade/index.js';

export interface StartupMaintenanceDependencies {
    autoUpgrade: () => Promise<void>;
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        autoUpgrade,
    };
}

export function runStartupMaintenance(
    dependencies: StartupMaintenanceDependencies = createDefaultDependencies()
): void {
    if (!process.env.BKPER_DISABLE_AUTOUPDATE) {
        dependencies.autoUpgrade().catch(() => {});
    }
}
