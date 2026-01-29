import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';

const { __dirname } = getTestPaths(import.meta.url);

// Temp directory for test app config
const testDir = path.join(__dirname, '../../../fixtures/temp-config-test');
const fixturesDir = path.join(__dirname, '../../../fixtures/configs');

describe('CLI - apps config functions', function() {
    const originalCwd = process.cwd();

    // Store references to functions we'll test
    let isSourceConfig: typeof import('../../../../src/commands/apps/config.js').isSourceConfig;
    let loadSourceDeploymentConfig: typeof import('../../../../src/commands/apps/config.js').loadSourceDeploymentConfig;
    let loadDeploymentConfig: typeof import('../../../../src/commands/apps/config.js').loadDeploymentConfig;

    before(async function() {
        const config = await import('../../../../src/commands/apps/config.js');
        isSourceConfig = config.isSourceConfig;
        loadSourceDeploymentConfig = config.loadSourceDeploymentConfig;
        loadDeploymentConfig = config.loadDeploymentConfig;
    });

    beforeEach(function() {
        setupTestEnvironment();
        // Create temp directory
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(function() {
        process.chdir(originalCwd);
        // Cleanup temp directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    describe('isSourceConfig', function() {
        it('should return true for TypeScript entry points in web.main', function() {
            const deployment = {
                web: { main: 'packages/web/server/src/index.ts', client: 'packages/web/client' },
                events: { main: 'packages/events/src/index.ts' }
            };
            expect(isSourceConfig(deployment)).to.be.true;
        });

        it('should return true for TypeScript entry points in events.main only', function() {
            const deployment = {
                events: { main: 'packages/events/src/index.ts' }
            };
            expect(isSourceConfig(deployment)).to.be.true;
        });

        it('should return false for directory paths (legacy bundle format)', function() {
            const deployment = {
                web: { bundle: 'packages/web/server/dist', assets: 'packages/web/client/dist' },
                events: { bundle: 'packages/events/dist' }
            };
            expect(isSourceConfig(deployment)).to.be.false;
        });

        it('should return false for null deployment', function() {
            expect(isSourceConfig(null)).to.be.false;
        });

        it('should return false for undefined deployment', function() {
            expect(isSourceConfig(undefined)).to.be.false;
        });

        it('should return false for non-object deployment', function() {
            expect(isSourceConfig('not-an-object')).to.be.false;
            expect(isSourceConfig(123)).to.be.false;
        });

        it('should return false for empty object', function() {
            expect(isSourceConfig({})).to.be.false;
        });

        it('should return false when main is not a string', function() {
            const deployment = {
                web: { main: 123 },
                events: { main: null }
            };
            expect(isSourceConfig(deployment)).to.be.false;
        });
    });

    describe('loadSourceDeploymentConfig', function() {
        it('should parse web config correctly', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.web).to.deep.equal({
                main: 'packages/web/server/src/index.ts',
                client: 'packages/web/client'
            });
        });

        it('should parse events config correctly', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.events).to.deep.equal({
                main: 'packages/events/src/index.ts'
            });
        });

        it('should parse services array correctly', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.services).to.deep.equal(['KV']);
        });

        it('should parse secrets array correctly', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.secrets).to.deep.equal(['API_KEY']);
        });

        it('should map compatibility_date to compatibilityDate', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.compatibilityDate).to.equal('2026-01-29');
        });

        it('should return undefined when deployment is not configured', function() {
            const noDeploymentPath = path.join(fixturesDir, 'no-deployment-config.yaml');
            fs.copyFileSync(noDeploymentPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.be.undefined;
        });

        it('should return undefined when config file does not exist', function() {
            process.chdir(testDir);
            // No config file created

            const config = loadSourceDeploymentConfig();

            expect(config).to.be.undefined;
        });

        it('should return undefined for legacy bundle format', function() {
            const legacyConfigPath = path.join(fixturesDir, 'legacy-config.yaml');
            fs.copyFileSync(legacyConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.be.undefined;
        });

        it('should check bkperapp.yaml as fallback', function() {
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkperapp.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.web?.main).to.equal('packages/web/server/src/index.ts');
        });

        it('should prefer bkper.yaml over bkperapp.yaml', function() {
            // Create both files with different content
            const sourceConfigPath = path.join(fixturesDir, 'source-config.yaml');
            const eventsOnlyPath = path.join(fixturesDir, 'events-only-source-config.yaml');
            
            fs.copyFileSync(sourceConfigPath, path.join(testDir, 'bkper.yaml'));
            fs.copyFileSync(eventsOnlyPath, path.join(testDir, 'bkperapp.yaml'));
            process.chdir(testDir);

            const config = loadSourceDeploymentConfig();

            // Should have web config from bkper.yaml (source-config.yaml)
            expect(config).to.not.be.undefined;
            expect(config?.web).to.not.be.undefined;
            expect(config?.web?.main).to.equal('packages/web/server/src/index.ts');
        });
    });

    describe('loadDeploymentConfig - backward compatibility', function() {
        it('should still work with legacy bundle format', function() {
            const legacyConfigPath = path.join(fixturesDir, 'legacy-config.yaml');
            fs.copyFileSync(legacyConfigPath, path.join(testDir, 'bkper.yaml'));
            process.chdir(testDir);

            const config = loadDeploymentConfig();

            expect(config).to.not.be.undefined;
            expect(config?.web).to.deep.equal({
                bundle: 'packages/web/server/dist',
                assets: 'packages/web/client/dist'
            });
            expect(config?.events).to.deep.equal({
                bundle: 'packages/events/dist'
            });
            expect(config?.services).to.deep.equal(['KV']);
        });

        it('should return undefined when no config file exists', function() {
            process.chdir(testDir);

            const config = loadDeploymentConfig();

            expect(config).to.be.undefined;
        });
    });
});
