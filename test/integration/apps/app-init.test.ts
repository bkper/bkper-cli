import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import path from 'path';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
import { assertNoVcsMetadata } from './helpers/cli-helpers.js';
import { expect } from '../helpers.js';

const APP_NAME = 'my-app';

describe('Integration: app init', function () {
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

    it('should create a new app with the correct structure', async function () {
        this.timeout(120000);

        appDir = await stateManager.getApp('init');

        // Verify app directory exists
        expect(fs.existsSync(appDir), 'appDir should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'package.json')), 'package.json should exist').to.be
            .true;
        expect(fs.existsSync(path.join(appDir, 'bkper.yaml')), 'bkper.yaml should exist').to.be
            .true;
        expect(fs.existsSync(path.join(appDir, 'packages/shared')), 'packages/shared should exist')
            .to.be.true;
        expect(
            fs.existsSync(path.join(appDir, 'packages/web/client')),
            'packages/web/client should exist'
        ).to.be.true;
        expect(
            fs.existsSync(path.join(appDir, 'packages/web/server')),
            'packages/web/server should exist'
        ).to.be.true;
        expect(fs.existsSync(path.join(appDir, 'packages/events')), 'packages/events should exist')
            .to.be.true;
    });

    it('should not include VCS metadata in the created app', async function () {
        this.timeout(5000);

        // Reuse the app directory from previous test or get a fresh one
        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        assertNoVcsMetadata(appDir);
    });

    it('should have installed dependencies', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        // Verify node_modules exists in packages
        expect(fs.existsSync(path.join(appDir, 'node_modules'))).to.be.true;
    });

    it('should have compiled shared types', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        // Verify TypeScript output exists
        const sharedDist = path.join(appDir, 'packages/shared/dist');
        expect(fs.existsSync(sharedDist)).to.be.true;
    });
});
