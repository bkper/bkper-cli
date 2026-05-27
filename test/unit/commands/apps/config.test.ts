import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';

const { __dirname } = getTestPaths(import.meta.url);

// Temp directory for test app config
const testDir = path.join(__dirname, '../../../fixtures/temp-config-test');
const fixturesDir = path.join(__dirname, '../../../fixtures/configs');

describe('CLI - apps config functions', function () {
    const originalCwd = process.cwd();

    let isSourceConfig: typeof import('../../../../src/commands/apps/config.js').isSourceConfig;
    let loadSourceDeploymentConfig: typeof import('../../../../src/commands/apps/config.js').loadSourceDeploymentConfig;
    let loadAppConfig: typeof import('../../../../src/commands/apps/config.js').loadAppConfig;
    let handleError: typeof import('../../../../src/commands/apps/config.js').handleError;

    before(async function () {
        const config = await import('../../../../src/commands/apps/config.js');
        isSourceConfig = config.isSourceConfig;
        loadSourceDeploymentConfig = config.loadSourceDeploymentConfig;
        loadAppConfig = config.loadAppConfig;
        handleError = config.handleError;
    });

    beforeEach(function () {
        setupTestEnvironment();
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(function () {
        sinon.restore();
        process.chdir(originalCwd);
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    describe('isSourceConfig', function () {
        it('should return true for TypeScript entry point in deployment.server', function () {
            expect(isSourceConfig({ server: 'server/src/index.ts', client: 'client' })).to.be.true;
        });

        it('should return false for removed split-worker deployment config', function () {
            const deployment = {
                web: { main: 'packages/web/server/src/index.ts', client: 'packages/web/client' },
                events: { main: 'packages/events/src/index.ts' },
            };
            expect(isSourceConfig(deployment)).to.be.false;
        });

        it('should return false for unsupported deployment shapes', function () {
            expect(isSourceConfig(null)).to.be.false;
            expect(isSourceConfig(undefined)).to.be.false;
            expect(isSourceConfig('not-an-object')).to.be.false;
            expect(isSourceConfig(123)).to.be.false;
            expect(isSourceConfig({})).to.be.false;
            expect(isSourceConfig({ server: 123 })).to.be.false;
            expect(isSourceConfig({ main: 'server/src/index.ts' })).to.be.false;
        });
    });

    describe('loadSourceDeploymentConfig', function () {
        it('should parse server and client config correctly', function () {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.server).to.equal('server/src/index.ts');
            expect(config?.client).to.equal('client');
        });

        it('should parse services, secrets, and compatibility date', function () {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config?.services).to.deep.equal(['KV']);
            expect(config?.secrets).to.deep.equal(['API_KEY']);
            expect(config?.compatibilityDate).to.equal('2026-01-29');
        });

        it('should return undefined when deployment is not configured', function () {
            const noDeploymentPath = path.join(fixturesDir, 'no-deployment-config.yaml');
            fs.copyFileSync(noDeploymentPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            expect(loadSourceDeploymentConfig()).to.be.undefined;
        });

        it('should return undefined when bkper.yaml does not exist', function () {
            process.chdir(testDir);

            expect(loadSourceDeploymentConfig()).to.be.undefined;
        });

        it('should return undefined for removed legacy bundle format', function () {
            const legacyConfigPath = path.join(fixturesDir, 'legacy-config.yaml');
            fs.copyFileSync(legacyConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            expect(loadSourceDeploymentConfig()).to.be.undefined;
        });

        it('should not read bkperapp.yaml fallback', function () {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkperapp.yaml'));
            process.chdir(testDir);

            expect(loadSourceDeploymentConfig()).to.be.undefined;
        });
    });

    describe('loadAppConfig', function () {
        it('should not read bkperapp.yaml fallback', function () {
            fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'id: test-app\nname: Test App\n');
            process.chdir(testDir);

            expect(() => loadAppConfig()).to.throw('bkper.yaml or bkper.json not found');
        });
    });

    describe('handleError', function () {
        it('should print the underlying API message for invalid token errors', function () {
            const consoleErrorStub = sinon.stub(console, 'error');
            const exitError = new Error('process.exit(1)');
            sinon.stub(process, 'exit').throws(exitError);

            let thrownError: unknown;
            try {
                handleError({
                    success: false,
                    error: {
                        code: 'INVALID_TOKEN',
                        message: 'Invalid or expired token',
                    },
                });
            } catch (err) {
                thrownError = err;
            }

            expect(thrownError).to.equal(exitError);
            expect(consoleErrorStub.calledWith('Error: Invalid or expired token')).to.be.true;
        });
    });
});
