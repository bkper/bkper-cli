import { updateSkills } from '../commands/skills.js';
import { autoUpgrade } from '../upgrade/index.js';

export interface StartupMaintenanceDependencies {
    autoUpgrade: () => Promise<void>;
    updateSkills: () => Promise<unknown>;
}

function createDefaultDependencies(): StartupMaintenanceDependencies {
    return {
        autoUpgrade,
        updateSkills: () => updateSkills({ silent: true }),
    };
}

export function runStartupMaintenance(
    dependencies: StartupMaintenanceDependencies = createDefaultDependencies()
): void {
    if (!process.env.BKPER_DISABLE_AUTOUPDATE) {
        dependencies.autoUpgrade().catch(() => {});
    }

    if (!process.env.BKPER_DISABLE_SKILLS_SYNC) {
        dependencies.updateSkills().catch(() => {});
    }
}
