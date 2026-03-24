export {
    VERSION,
    detectMethod,
    detectMethodAsync,
    fetchLatestVersion,
    getUpgradeCommand,
    startDetachedUpgrade,
} from './installation.js';
export {
    autoUpgrade,
    foregroundUpgrade,
    getAvailableUpgrade,
    isNewerVersion,
} from './upgrade.js';
export type { InstallMethod } from './installation.js';
export type { AvailableUpgrade } from './upgrade.js';
