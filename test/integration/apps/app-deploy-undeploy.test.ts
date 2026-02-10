import { describe, it, before, after } from 'mocha';
import { AppStateManager } from './helpers/app-state.js';
import { setupDeployTest } from './helpers/test-setup.js';
import { runCli } from './helpers/cli-helpers.js';

describe('Integration: app deploy/undeploy', function () {
    let stateManager: AppStateManager | undefined;
    let appDir: string | undefined;
    let setupComplete = false;

    before(async function () {
        this.timeout(60000);
        await setupDeployTest(this, 60000);

        // If we get here, setup didn't skip
        setupComplete = true;
        stateManager = new AppStateManager();

        // Get a built app (already has dist/ artifacts)
        appDir = await stateManager.getApp('built');
    });

    after(async function () {
        this.timeout(120000);

        // Only cleanup if setup completed
        if (!setupComplete) {
            return;
        }

        // Always cleanup: undeploy both web and events, even if tests failed
        try {
            console.log('\n  Cleaning up: undeploying events handler...');
            await runCli(['app', 'undeploy', '--preview', '--events', '--force'], appDir!);
        } catch {
            // Ignore errors - may not be deployed
        }

        try {
            console.log('  Cleaning up: undeploying web handler...');
            await runCli(['app', 'undeploy', '--preview', '--force'], appDir!);
        } catch {
            // Ignore errors - may not be deployed
        }

        // Clean up temp directories
        await stateManager!.reset();
    });

    it('should deploy web handler to dev environment', async function () {
        this.timeout(120000);

        // Deploy web handler (uses --dev flag)
        // Command succeeds = deploy worked (CLI handles errors internally)
        await runCli(['app', 'deploy', '--preview'], appDir!);
    });

    it('should deploy events handler to dev environment', async function () {
        this.timeout(120000);

        // Deploy events handler (uses --dev and --events flags)
        await runCli(['app', 'deploy', '--preview', '--events'], appDir!);
    });

    it('should undeploy events handler from dev environment', async function () {
        this.timeout(60000);

        // Undeploy events handler
        // Command succeeds = undeploy worked (CLI handles errors internally)
        await runCli(['app', 'undeploy', '--preview', '--events', '--force'], appDir!);
    });

    it('should undeploy web handler from dev environment', async function () {
        this.timeout(60000);

        // Undeploy web handler
        await runCli(['app', 'undeploy', '--preview', '--force'], appDir!);
    });
});
