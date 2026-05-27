import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import path from 'path';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
import { assertArtifacts, runCli } from './helpers/cli-helpers.js';
import { expect } from '../helpers.js';

describe('Integration: app build', function () {
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

    it('should build the server Worker artifact', async function () {
        this.timeout(120000);

        // Get initialized app
        appDir = await stateManager.getApp('init');

        // Run build
        await runCli(['app', 'build'], appDir);

        // Verify artifacts exist
        assertArtifacts(appDir);
    });

    it('should create server-side bundle', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('built');
        }

        const serverPath = path.join(appDir, 'dist/server/index.js');
        expect(fs.existsSync(serverPath)).to.be.true;
        expect(fs.statSync(serverPath).size).to.be.greaterThan(0);
    });

    it('should not create split-worker artifact directories', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('built');
        }

        expect(fs.existsSync(path.join(appDir, 'dist/web'))).to.be.false;
        expect(fs.existsSync(path.join(appDir, 'dist/events'))).to.be.false;
    });
});
