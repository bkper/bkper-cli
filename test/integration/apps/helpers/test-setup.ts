import fs from 'fs';
import {
  isPlatformRunning,
  isUserLoggedIn,
  TestConfig,
} from '../../helpers.js';

const CLI_PATH = '/workspace/bkper-cli/lib/cli.js';

/**
 * Standard setup hook for app command tests.
 * Checks prerequisites and skips if not met.
 */
export async function setupAppTest(
  context: Mocha.Context,
  timeoutMs: number = 20000
): Promise<void> {
  context.timeout(timeoutMs);

  process.env.BKPER_PLATFORM_URL = TestConfig.PLATFORM_URL;
  process.env.BKPER_API_URL = process.env.BKPER_API_URL || 'https://api-dev.bkper.app';

  if (!fs.existsSync(CLI_PATH)) {
    console.log('\n  Skipping: CLI build not found at /workspace/bkper-cli/lib/cli.js');
    console.log('   Build it with: cd bkper-cli && bun run build\n');
    return context.skip();
  }

  const platformRunning = await isPlatformRunning();
  if (!platformRunning) {
    console.log('\n  Skipping: Platform worker not running at localhost:8790');
    console.log('   Start it with: cd bkper-clients/packages/platform && bun dev\n');
    return context.skip();
  }

  if (!isUserLoggedIn()) {
    console.log('\n  Skipping: User not logged in');
    console.log('   Login with: bkper login\n');
    return context.skip();
  }
}
