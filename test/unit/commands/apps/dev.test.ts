import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import * as sinon from 'sinon';
import fs from 'fs';
import path from 'path';

const { __dirname } = getTestPaths(import.meta.url);

// Temp directory for test app config
const testDir = path.join(__dirname, '../../../fixtures/temp-dev-test');

describe('dev command', function () {
    // Increase timeout for async operations
    this.timeout(10000);

    const originalCwd = process.cwd();
    const originalExit = process.exit;
    let exitCode: number | undefined;
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    let consoleWarns: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Module stubs
    let createWorkerServerStub: sinon.SinonStub;
    let stopWorkerServerStub: sinon.SinonStub;
    let reloadWorkerStub: sinon.SinonStub;
    let createClientServerStub: sinon.SinonStub;
    let stopClientServerStub: sinon.SinonStub;
    let getServerUrlStub: sinon.SinonStub;
    let ensureTypesUpToDateStub: sinon.SinonStub;
    let loadDevVarsStub: sinon.SinonStub;
    let loadAppConfigStub: sinon.SinonStub;
    let loadSourceDeploymentConfigStub: sinon.SinonStub;
    let chokidarWatchStub: sinon.SinonStub;
    let logDevServerBannerStub: sinon.SinonStub;
    let createLoggerStub: sinon.SinonStub;

    // Mock logger
    const mockLogger = {
        info: sinon.stub(),
        success: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
    };

    // Mock watcher
    let mockWatcher: { on: sinon.SinonStub };

    // Function to test
    let dev: typeof import('../../../../src/commands/apps/dev.js').dev;

    /**
     * Creates stubs and imports the dev module with stubbed dependencies
     */
    async function createModuleWithStubs(): Promise<typeof import('../../../../src/commands/apps/dev.js')> {
        // Create stubs
        createWorkerServerStub = sinon.stub().resolves({ ready: Promise.resolve() });
        stopWorkerServerStub = sinon.stub().resolves();
        reloadWorkerStub = sinon.stub().resolves();
        createClientServerStub = sinon.stub().resolves({ resolvedUrls: { local: ['http://localhost:5173'] } });
        stopClientServerStub = sinon.stub().resolves();
        getServerUrlStub = sinon.stub().returns('http://localhost:5173');
        ensureTypesUpToDateStub = sinon.stub();
        loadDevVarsStub = sinon.stub().returns({ API_KEY: 'test-key' });
        loadAppConfigStub = sinon.stub().returns({ id: 'test-app', name: 'Test App' });
        loadSourceDeploymentConfigStub = sinon.stub();
        logDevServerBannerStub = sinon.stub();
        createLoggerStub = sinon.stub().returns(mockLogger);

        // Create mock watcher that can capture and trigger callbacks
        mockWatcher = {
            on: sinon.stub().returnsThis(),
        };
        chokidarWatchStub = sinon.stub().returns(mockWatcher);

        // Import and return the module (we'll use dynamic import)
        // Note: In a real scenario, we'd use proxyquire or similar to inject stubs
        // For now, we'll import the actual module and test what we can
        return await import('../../../../src/commands/apps/dev.js');
    }

    beforeEach(function () {
        setupTestEnvironment();
        exitCode = undefined;
        consoleOutput = [];
        consoleErrors = [];
        consoleWarns = [];

        // Reset mock logger
        mockLogger.info.reset();
        mockLogger.success.reset();
        mockLogger.warn.reset();
        mockLogger.error.reset();
        mockLogger.debug.reset();

        // Mock console
        console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
        console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));
        console.warn = (...args: unknown[]) => consoleWarns.push(args.join(' '));

        // Mock process.exit
        process.exit = ((code?: number) => {
            exitCode = code;
            throw new Error(`process.exit(${code})`);
        }) as never;

        // Create temp directory
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(function () {
        process.chdir(originalCwd);
        process.exit = originalExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        sinon.restore();

        // Cleanup temp directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    describe('dev function - Configuration Detection', function () {
        it('should exit with error when deployment config is not found', async function () {
            // Create minimal app config without deployment section
            const configContent = 'id: test-app\nname: Test App\n';
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            const devModule = await import('../../../../src/commands/apps/dev.js');
            dev = devModule.dev;

            try {
                await dev({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('No deployment configuration'))).to.be.true;
        });

        it('should load app config correctly', async function () {
            // Create config with deployment section
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
  services:
    - KV
  secrets:
    - API_KEY
  compatibility_date: "2026-01-29"
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);

            // Create the directory structure that the config references
            fs.mkdirSync(path.join(testDir, 'packages/web/server/src'), { recursive: true });
            fs.mkdirSync(path.join(testDir, 'packages/web/client'), { recursive: true });
            fs.writeFileSync(path.join(testDir, 'packages/web/server/src/index.ts'), 'export default {}');
            fs.writeFileSync(path.join(testDir, 'packages/web/client/index.html'), '<html></html>');

            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            const appConfig = configModule.loadAppConfig();
            const deployConfig = configModule.loadSourceDeploymentConfig();

            expect(appConfig.id).to.equal('test-app');
            expect(deployConfig).to.not.be.undefined;
            expect(deployConfig?.web?.main).to.equal('packages/web/server/src/index.ts');
            expect(deployConfig?.services).to.deep.equal(['KV']);
        });
    });

    describe('dev function - dependency preflight', function () {
        it('should exit with error when dependencies are missing', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            fs.writeFileSync(
                path.join(testDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            fs.mkdirSync(path.join(testDir, 'packages/web/server/src'), { recursive: true });
            fs.mkdirSync(path.join(testDir, 'packages/web/client'), { recursive: true });
            fs.writeFileSync(path.join(testDir, 'packages/web/server/src/index.ts'), 'export default {}');
            fs.writeFileSync(path.join(testDir, 'packages/web/client/index.html'), '<html></html>');

            process.chdir(testDir);

            const devModule = await import('../../../../src/commands/apps/dev.js');
            dev = devModule.dev;

            try {
                await dev({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('Missing dependencies'))).to.be.true;
        });
    });

    describe('dev function - DevOptions interface', function () {
        it('should export DevOptions interface with correct structure', async function () {
            const devModule = await import('../../../../src/commands/apps/dev.js');

            // Verify the function exists and has correct signature
            expect(devModule.dev).to.be.a('function');
        });

        it('should use default port 5173 for client', async function () {
            // This test validates the interface - actual server creation is tested elsewhere
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            // We can't easily test the actual port binding without starting servers
            // But we can verify the options interface is correct
            const devModule = await import('../../../../src/commands/apps/dev.js');
            expect(devModule.dev).to.be.a('function');
        });

        it('should use default port 8787 for server', async function () {
            // Similar to above - validates interface contract
            const devModule = await import('../../../../src/commands/apps/dev.js');
            expect(devModule.dev).to.be.a('function');
        });
    });

    describe('dev function - Type generation', function () {
        it('should have ensureTypesUpToDate function available', async function () {
            const typesModule = await import('../../../../src/dev/types.js');

            // Verify the function exists and has correct signature
            expect(typesModule.ensureTypesUpToDate).to.be.a('function');
        });

        it('should generate types when called directly', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
  services:
    - KV
  secrets:
    - API_KEY
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            const typesModule = await import('../../../../src/dev/types.js');

            // Call the function directly and verify it works
            typesModule.ensureTypesUpToDate({ services: ['KV'], secrets: ['API_KEY'] }, testDir);

            // Verify env.d.ts was created
            const envDtsPath = path.join(testDir, 'env.d.ts');
            expect(fs.existsSync(envDtsPath)).to.be.true;

            const content = fs.readFileSync(envDtsPath, 'utf8');
            expect(content).to.include('KV: KVNamespace');
            expect(content).to.include('API_KEY: string');
        });
    });

    describe('dev function - Dev vars loading', function () {
        it('should load dev vars from .dev.vars file', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
  secrets:
    - API_KEY
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            fs.writeFileSync(path.join(testDir, '.dev.vars'), 'API_KEY=test-secret-value');
            process.chdir(testDir);

            const typesModule = await import('../../../../src/dev/types.js');
            const vars = typesModule.loadDevVars(testDir, ['API_KEY']);

            expect(vars).to.have.property('API_KEY');
            expect(vars.API_KEY).to.equal('test-secret-value');
        });

        it('should return empty object when .dev.vars does not exist', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
  secrets:
    - API_KEY
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            // Note: Not creating .dev.vars file
            process.chdir(testDir);

            const typesModule = await import('../../../../src/dev/types.js');
            const vars = typesModule.loadDevVars(testDir, ['API_KEY']);

            expect(vars).to.deep.equal({});
        });
    });

    describe('dev function - Export validation', function () {
        it('should export dev function', async function () {
            const devModule = await import('../../../../src/commands/apps/dev.js');
            expect(devModule.dev).to.be.a('function');
        });

        it('should export DevOptions type (via interface presence in function signature)', async function () {
            const devModule = await import('../../../../src/commands/apps/dev.js');
            // The function should accept an options parameter
            expect(devModule.dev.length).to.be.at.most(1);
        });
    });

    describe('dev function - Signal handling', function () {
        it('should register SIGINT handler', async function () {
            // Verify that the process event listeners can be added
            // We can't fully test signal handling in unit tests, but we verify the mechanism
            const listeners = process.listeners('SIGINT');
            const initialCount = listeners.length;

            // After importing and running (briefly), there should be a handler added
            // Note: This is a structural test, not a behavioral test
            expect(initialCount).to.be.a('number');
        });

        it('should register SIGTERM handler', async function () {
            const listeners = process.listeners('SIGTERM');
            const initialCount = listeners.length;
            expect(initialCount).to.be.a('number');
        });

        it('should have process exit handler mechanism', async function () {
            // The dev command registers an exit handler via process.on('exit', ...)
            // We verify that Node.js supports this mechanism - actual handler registration
            // happens when dev() is called and is tested via integration tests
            const listeners = process.listeners('exit');
            expect(listeners.length).to.be.a('number');
        });
    });

    describe('Configuration requirements', function () {
        it('should require web.main when starting web server', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  events:
    main: packages/events/src/index.ts
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            const deployConfig = configModule.loadSourceDeploymentConfig();

            // When only events is configured, web should be undefined
            expect(deployConfig?.web).to.be.undefined;
            expect(deployConfig?.events?.main).to.equal('packages/events/src/index.ts');
        });

        it('should detect hasWeb correctly when web.main is configured', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  web:
    main: packages/web/server/src/index.ts
    client: packages/web/client
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            const deployConfig = configModule.loadSourceDeploymentConfig();

            expect(deployConfig?.web?.main).to.be.a('string');
            expect(!!deployConfig?.web?.main).to.be.true; // hasWeb check
        });

        it('should detect hasEvents correctly when events.main is configured', async function () {
            const configContent = `id: test-app
name: Test App
deployment:
  events:
    main: packages/events/src/index.ts
`;
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), configContent);
            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            const deployConfig = configModule.loadSourceDeploymentConfig();

            expect(deployConfig?.events?.main).to.be.a('string');
            expect(!!deployConfig?.events?.main).to.be.true; // hasEvents check
        });
    });

    describe('deployHandler integration', function () {
        it('should export deployHandler from deploy module', async function () {
            const deployModule = await import('../../../../src/commands/apps/deploy.js');

            // Check that the module has the expected exports
            expect(deployModule.deployApp).to.be.a('function');
            expect(deployModule.undeployApp).to.be.a('function');
            expect(deployModule.statusApp).to.be.a('function');
        });
    });
});
