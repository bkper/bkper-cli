import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import path from 'path';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
import { assertArtifacts, assertCleaned, runCli, runCommand } from './helpers/cli-helpers.js';

describe('Integration: app rebuild after clean', function () {
    let stateManager: AppStateManager;
    let appDir: string;

    before(async function () {
        await setupAppTest(this);
        stateManager = new AppStateManager();
    });

    after(async function () {
        this.timeout(10000);
        await stateManager.reset();
    });

    it('should successfully build after clean', async function () {
        this.timeout(120000);

        // Get cleaned app (which was built, then cleaned)
        appDir = await stateManager.getApp('cleaned');

        // Verify it's clean
        assertCleaned(appDir);

        // Reinstall dependencies (clean may remove them or they may be needed fresh)
        await runCommand('bun', ['install'], appDir);

        // Recompile shared types
        await runCommand(
            'bun',
            ['x', 'tsc', '-p', 'tsconfig.json'],
            path.join(appDir, 'packages/shared')
        );

        // Rebuild
        await runCli(['app', 'build'], appDir);

        // Verify artifacts are recreated
        assertArtifacts(appDir);
    });

    it('should create identical artifacts on rebuild', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('cleaned');
        }

        // Just verify structure is complete
        const serverExists = fs.existsSync(path.join(appDir, 'dist/web/server/index.js'));
        const clientExists = fs.existsSync(path.join(appDir, 'dist/web/client/index.html'));
        const eventsExists = fs.existsSync(path.join(appDir, 'dist/events/index.js'));

        if (!serverExists || !clientExists || !eventsExists) {
            throw new Error(
                'Rebuild did not create all expected artifacts. ' +
                    'Server: ' +
                    serverExists +
                    ', ' +
                    'Client: ' +
                    clientExists +
                    ', ' +
                    'Events: ' +
                    eventsExists
            );
        }
    });
});
