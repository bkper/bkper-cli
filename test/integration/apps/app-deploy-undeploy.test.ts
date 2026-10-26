import { describe, it, before, after } from 'mocha';
import { AppStateManager } from './helpers/app-state.js';
import { setupDeployTest } from './helpers/test-setup.js';
import { runCli } from './helpers/cli-helpers.js';

describe('Integration: app deploy/undeploy', function () {
    let stateManager: AppStateManager | undefined;
    let appDir: string | undefined;
    let setupComplete = false;
    let appDeployed = false;

    before(async function () {
        this.timeout(120000);
        await setupDeployTest(this, 120000);

        // If we get here, setup didn't skip
        setupComplete = true;
        stateManager = new AppStateManager();

        // Deploys require a built app whose source is stored as Bkper-managed source
        appDir = await stateManager.getManagedApp();
    });

    after(async function () {
        this.timeout(120000);

        // Only cleanup if setup completed
        if (!setupComplete) {
            return;
        }

        // Cleanup only what is still deployed if tests aborted mid-flow
        if (appDeployed) {
            try {
                console.log('\n  Cleaning up: undeploying app...');
                await runCli(['app', 'undeploy', '--preview', '--force'], appDir!);
            } catch {
                // Ignore errors - may not be deployed
            }
        }

        // Clean up temp directories
        await stateManager!.reset();
    });

    it('should deploy the app Worker to preview environment', async function () {
        this.timeout(120000);

        // Command succeeds = deploy worked (CLI handles errors internally)
        await runCli(['app', 'deploy', '--preview'], appDir!);
        appDeployed = true;
    });

    it('should undeploy the app Worker from preview environment', async function () {
        this.timeout(60000);

        await runCli(['app', 'undeploy', '--preview', '--force'], appDir!);
        appDeployed = false;
    });
});
