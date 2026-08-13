import { describe, it, before, after } from 'mocha';
import fs from 'fs';
import path from 'path';
import { AppStateManager } from './helpers/app-state.js';
import { setupAppTest } from './helpers/test-setup.js';
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
        this.timeout(60000);
        await stateManager.reset();
    });

    it('should create a new app with the correct structure', async function () {
        this.timeout(120000);

        appDir = await stateManager.getApp('init');

        // Verify app directory exists
        expect(fs.existsSync(appDir), 'appDir should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'package.json')), 'package.json should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'bkper.yaml')), 'bkper.yaml should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'client')), 'client should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'server')), 'server should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'client/src')), 'client/src should exist').to.be.true;
        expect(fs.existsSync(path.join(appDir, 'server/src')), 'server/src should exist').to.be.true;
    });

    it('should initialize Git without creating a commit', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        expect(fs.existsSync(path.join(appDir, '.git'))).to.be.true;
        expect(fs.readFileSync(path.join(appDir, '.git/HEAD'), 'utf8').trim()).to.equal(
            'ref: refs/heads/main'
        );
        expect(fs.existsSync(path.join(appDir, '.git/refs/heads/main'))).to.be.false;
    });

    it('should not install dependencies', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        expect(fs.existsSync(path.join(appDir, 'node_modules'))).to.be.false;
    });

    it('should include valid agent guidance markers and its dedicated check command', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        const agents = fs.readFileSync(path.join(appDir, 'AGENTS.md'), 'utf8');
        const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));

        expect(agents.indexOf('<!-- APP_STANDARDS:START -->')).to.be.lessThan(
            agents.indexOf('<!-- APP_SPECIFICS:START -->')
        );
        expect(packageJson.scripts['check:agent-guidance']).to.equal(
            'bun scripts/check-agent-guidance.ts'
        );
    });

    it('should include generated environment types', async function () {
        this.timeout(5000);

        if (!appDir) {
            appDir = await stateManager.getApp('init');
        }

        expect(fs.existsSync(path.join(appDir, 'env.d.ts'))).to.be.true;
    });
});
