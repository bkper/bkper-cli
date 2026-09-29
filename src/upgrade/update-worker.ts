import { runUpdateWorker } from './update-check.js';

// Detached entry point started by maybeStartUpdateCheck().
runUpdateWorker().catch(() => {
    // Never surface worker errors
});
