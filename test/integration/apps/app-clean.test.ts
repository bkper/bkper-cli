import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import path from 'path';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
import { assertCleaned, assertArtifacts, runCommand } from './helpers/cli-helpers.js';
import { expect } from '../helpers.js';

describe('Integration: app clean', function () {
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

    it('should remove build artifacts', async function () {
        this.timeout(60000);

        // Get built app
        appDir = await stateManager.getApp('built');

        // Verify artifacts exist before clean
        assertArtifacts(appDir);

        // Run clean
        await runCommand('bun', ['run', 'clean'], appDir);

        // Verify artifacts are removed
        assertCleaned(appDir);
    });

    it('should preserve source files', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('cleaned');
        }

        // Verify source files still exist
        expect(fs.existsSync(path.join(appDir, 'package.json'))).to.be.true;
        expect(fs.existsSync(path.join(appDir, 'packages/web/client/src'))).to.be.true;
        expect(fs.existsSync(path.join(appDir, 'packages/web/server/src'))).to.be.true;
        expect(fs.existsSync(path.join(appDir, 'packages/events/src'))).to.be.true;
    });

    it('should remove node_modules', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('cleaned');
        }

        // Clean command removes node_modules
        expect(fs.existsSync(path.join(appDir, 'node_modules'))).to.be.false;
    });
});
