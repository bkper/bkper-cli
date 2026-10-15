import {applyPiPackageDir} from '../utils/package-dir.js';

// Pi reads PI_PACKAGE_DIR while its modules load, so agent-entry imports this module first.
applyPiPackageDir();
