export {
    PACKAGE_DIR,
    VERSION,
    detectInstallMethod,
    fetchLatestVersion,
    getInstallCommand,
    getSelfUpdatePlan,
} from './installation.js';
export { foregroundUpgrade, isNewerVersion, runUpgrade } from './upgrade.js';
export {
    AGENT_CHECK_INTERVAL_MS,
    formatUpdateNotice,
    getUpdateNotice,
    isUpdateCheckDisabled,
    maybeStartUpdateCheck,
    readUpdateState,
    runCommandUpdateCheck,
} from './update-check.js';
export type { InstallMethod, SelfUpdatePlan } from './installation.js';
export type { StartUpdateCheckOptions, UpdateNotice } from './update-check.js';
