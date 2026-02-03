import { describe, it, before, after } from 'mocha';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
import { startCli, stopProcess, waitForUrl } from './helpers/cli-helpers.js';
import { TestConfig } from '../helpers.js';
import type { ChildProcess } from 'child_process';

describe('Integration: app dev', function () {
    let stateManager: AppStateManager;
    let appDir: string;
    let devProcess: ChildProcess | null = null;

    before(async function () {
        await setupAppTest(this);
        stateManager = new AppStateManager();
    });

    after(async function () {
        this.timeout(15000);

        if (devProcess) {
            await stopProcess(devProcess, 10000);
            devProcess = null;
        }

        await stateManager.reset();
    });

    it('should start the dev server and respond to health checks', async function () {
        this.timeout(120000);

        // Get initialized app (state manager handles dependency)
        appDir = await stateManager.getApp('init');

        // Start dev server
        devProcess = startCli(['app', 'dev'], appDir);

        // Wait for web server to be ready
        await waitForUrl('http://localhost:8787/health', 60000);

        // Wait for events server to be ready
        await waitForUrl(TestConfig.DEV_EVENTS_URL, 60000);
    });

    it('should handle graceful shutdown on SIGINT', async function () {
        this.timeout(30000);

        // Start a fresh dev process if needed
        if (!devProcess) {
            appDir = await stateManager.getApp('init');
            devProcess = startCli(['app', 'dev'], appDir);
            await waitForUrl('http://localhost:8787/health', 60000);
        }

        // Stop the process
        await stopProcess(devProcess, 15000);
        devProcess = null;

        // Verify process exited
        // (stopProcess throws if it fails to stop)
    });
});
