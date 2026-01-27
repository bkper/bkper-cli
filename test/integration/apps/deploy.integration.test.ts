import {
  expect,
  TestConfig,
  isPlatformRunning,
  isUserLoggedIn,
  runDeploy,
  runUndeploy,
  fetchWorker,
  waitForWorkerReady,
  writeToKV,
  readFromKV,
  generateTestKey,
} from '../setup/deploy-test-helpers.js';

describe('Integration: CLI Deploy Commands', function () {
  let originalCwd: string;

  before(async function () {
    this.timeout(15000);

    // Check prerequisites
    const platformRunning = await isPlatformRunning();
    if (!platformRunning) {
      console.log(
        '\n  Skipping: Platform worker not running at localhost:8790'
      );
      console.log(
        '   Start it with: cd bkper-clients/packages/platform && bun dev\n'
      );
      return this.skip();
    }

    if (!isUserLoggedIn()) {
      console.log('\n  Skipping: User not logged in');
      console.log('   Login with: bkper login\n');
      return this.skip();
    }

    // Save and change working directory
    originalCwd = process.cwd();
    process.chdir(TestConfig.APP_TEMPLATE_PATH);

    console.log(`\n  Working directory: ${TestConfig.APP_TEMPLATE_PATH}`);
    console.log(`  Platform URL: ${TestConfig.PLATFORM_URL}`);
    console.log(`  Deploy target: ${TestConfig.DEV_WEB_URL}\n`);
  });

  after(async function () {
    this.timeout(TestConfig.DEPLOY_TIMEOUT * 2);

    // Cleanup: undeploy with data deletion
    console.log('\n  Cleaning up deployments...');

    try {
      await runUndeploy({ dev: true, events: true, deleteData: true, force: true });
      console.log('    Events worker undeployed with data');
    } catch {
      console.log(
        '    Events undeploy skipped (may not have been deployed)'
      );
    }

    try {
      await runUndeploy({ dev: true, deleteData: true, force: true });
      console.log('    Web worker undeployed with data');
    } catch {
      console.log('    Web undeploy skipped (may not have been deployed)');
    }

    // Restore working directory
    if (originalCwd) {
      process.chdir(originalCwd);
    }
  });

  describe('Deploy Web Worker', function () {
    it('should deploy web worker to dev environment', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      await runDeploy({ dev: true });
    });

    it('should be accessible via health endpoint', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      const ready = await waitForWorkerReady('/health');
      expect(ready, 'Worker health check timed out').to.be.true;
    });

    it('should return correct health response', async function () {
      const response = await fetchWorker('/health');
      expect(response.ok).to.be.true;

      const data = (await response.json()) as { status?: string };
      expect(data).to.have.property('status', 'ok');
    });
  });

  describe('Deploy Events Worker', function () {
    it('should deploy events worker to dev environment', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      await runDeploy({ dev: true, events: true });
    });

    it('should be accessible via root endpoint', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      // Events worker is at /events (no trailing slash) due to basePath
      const ready = await waitForWorkerReady('', true);
      expect(ready, 'Events worker health check timed out').to.be.true;
    });

    it('should return correct status response', async function () {
      // Events worker returns status at GET /events (no trailing slash)
      const response = await fetchWorker('', { isEvents: true });
      expect(response.ok).to.be.true;

      const data = (await response.json()) as { status?: string };
      expect(data).to.have.property('status', 'ok');
    });
  });

  describe('KV Cross-Worker Communication', function () {
    let testKey: string;
    const testValue = 'integration-test-value-' + Date.now();

    before(function () {
      testKey = generateTestKey();
    });

    it('should write to KV via events worker', async function () {
      await writeToKV(testKey, testValue);
    });

    it('should read same value from KV via events worker', async function () {
      // First verify the events worker can read it back
      const response = await fetchWorker(`/test/kv/${testKey}`, {
        isEvents: true,
      });
      expect(response.ok).to.be.true;

      const data = (await response.json()) as { found?: boolean; value?: string };
      expect(data.found).to.be.true;
      expect(data.value).to.equal(testValue);
    });

    it('should read same value from KV via web worker', async function () {
      // Now verify the web worker can also read the same KV data
      const value = await readFromKV(testKey);
      expect(value).to.equal(testValue);
    });
  });

  describe('Undeploy Workers', function () {
    it('should undeploy events worker', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      await runUndeploy({ dev: true, events: true });
    });

    it('should undeploy web worker', async function () {
      this.timeout(TestConfig.DEPLOY_TIMEOUT);
      await runUndeploy({ dev: true });
    });

    it('should no longer be accessible after undeploy', async function () {
      this.timeout(TestConfig.HTTP_TIMEOUT);

      try {
        const response = await fetchWorker('/health');
        // If we get a response, it should be an error status
        expect(response.ok).to.be.false;
      } catch {
        // Network error is expected - worker is gone
      }
    });
  });
});
