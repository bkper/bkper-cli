import fs from 'fs';
import { isUserLoggedIn, determinePlatformUrl } from '../../helpers.js';
import { initializePlatformUrl, getPlatformUrl } from './cli-helpers.js';

const CLI_PATH = '/workspace/bkper-cli/lib/cli.js';

/**
 * Check if platform has deploy API available
 */
async function isDeployApiAvailable(platformUrl: string): Promise<boolean> {
    try {
        // Check if the apps endpoint exists
        // If auth is required, it returns 401/403 which means the route exists
        // If route doesn't exist, it returns 404
        const response = await fetch(`${platformUrl}/api/apps/test-app`, {
            signal: AbortSignal.timeout(5000),
        });
        // Any response (401 auth required, 404 app not found) means the API exists
        // Only return false if we can't connect at all
        return response.status !== 0; // status 0 means network error
    } catch {
        return false;
    }
}

/**
 * Standard setup hook for app command tests.
 * Checks prerequisites and skips if not met.
 * Tries localhost:8790 first, falls back to platform-dev.bkper.app
 */
export async function setupAppTest(context: Mocha.Context, timeoutMs: number = 30000): Promise<void> {
    context.timeout(timeoutMs);

    if (!fs.existsSync(CLI_PATH)) {
        console.log('\n  Skipping: CLI build not found at /workspace/bkper-cli/lib/cli.js');
        console.log('   Build it with: cd bkper-cli && bun run build\n');
        return context.skip();
    }

    // Try to connect to platform (localhost first, then fallback)
    const platformUrl = await initializePlatformUrl();
    if (!platformUrl) {
        console.log('\n  Skipping: Platform not accessible');
        console.log('   Tried: localhost:8790 and platform-dev.bkper.app');
        console.log('   Start local platform with: cd bkper-clients/packages/platform && bun dev\n');
        return context.skip();
    }

    console.log(`\n  Using platform: ${platformUrl}`);
    process.env.BKPER_PLATFORM_URL = platformUrl;
    process.env.BKPER_API_URL = process.env.BKPER_API_URL || 'https://api-dev.bkper.app';

    if (!isUserLoggedIn()) {
        console.log('\n  Skipping: User not logged in');
        console.log('   Login with: bkper login\n');
        return context.skip();
    }
}

/**
 * Setup hook specifically for deploy/undeploy tests.
 * Checks that platform has full deploy API available.
 */
export async function setupDeployTest(context: Mocha.Context, timeoutMs: number = 30000): Promise<void> {
    await setupAppTest(context, timeoutMs);

    // If we get here, basic setup passed - now check for deploy API
    const platformUrl = getPlatformUrl();
    const hasDeployApi = await isDeployApiAvailable(platformUrl);
    if (!hasDeployApi) {
        console.log('  Skipping: Platform API does not support deploy operations');
        console.log(`   Platform at ${platformUrl} appears to be a dev server only`);
        console.log('   Full platform required for deploy/undeploy tests\n');
        return context.skip();
    }
}
