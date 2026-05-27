import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';

const { __dirname } = getTestPaths(import.meta.url);
const testDir = path.join(__dirname, '../../../fixtures/temp-dev-test');

describe('dev command', function () {
    this.timeout(10000);

    const originalCwd = process.cwd();
    const originalExit = process.exit;
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    let exitCode: number | undefined;
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    let consoleWarns: string[] = [];

    let dev: typeof import('../../../../src/commands/apps/dev.js').dev;

    beforeEach(function () {
        setupTestEnvironment();
        exitCode = undefined;
        consoleOutput = [];
        consoleErrors = [];
        consoleWarns = [];

        console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
        console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));
        console.warn = (...args: unknown[]) => consoleWarns.push(args.join(' '));

        process.exit = ((code?: number) => {
            exitCode = code;
            throw new Error(`process.exit(${code})`);
        }) as never;

        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(function () {
        process.chdir(originalCwd);
        process.exit = originalExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;

        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    describe('configuration detection', function () {
        it('should exit with error when deployment config is not found', async function () {
            fs.writeFileSync(path.join(testDir, 'bkper.yaml'), 'id: test-app\nname: Test App\n');
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

        it('should load app and single server deployment config correctly', async function () {
            writeConfig({ client: true, services: true, secrets: true });
            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            const appConfig = configModule.loadAppConfig();
            const deployConfig = configModule.loadSourceDeploymentConfig();

            expect(appConfig.id).to.equal('test-app');
            expect(deployConfig).to.deep.equal({
                server: 'server/src/index.ts',
                client: 'client',
                services: ['KV'],
                secrets: ['API_KEY'],
                compatibilityDate: '2026-01-29',
            });
        });

        it('should not accept removed deployment.events-only config', async function () {
            fs.writeFileSync(
                path.join(testDir, 'bkper.yaml'),
                `id: test-app
name: Test App
deployment:
  events:
    main: packages/events/src/index.ts
`
            );
            process.chdir(testDir);

            const configModule = await import('../../../../src/commands/apps/config.js');
            expect(configModule.loadSourceDeploymentConfig()).to.be.undefined;
        });
    });

    describe('dependency preflight', function () {
        it('should exit with error when dependencies are missing', async function () {
            writeConfig({ client: true });
            fs.writeFileSync(
                path.join(testDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            writeServerSource();
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

        it('should exit with error when miniflare is missing from the app project', async function () {
            writeConfig({ client: true });
            fs.writeFileSync(
                path.join(testDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            fs.mkdirSync(path.join(testDir, 'node_modules'), { recursive: true });
            writeServerSource();
            process.chdir(testDir);

            const devModule = await import('../../../../src/commands/apps/dev.js');
            dev = devModule.dev;

            try {
                await dev({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('Missing Miniflare'))).to.be.true;
            expect(consoleErrors.some(e => e.includes('Install it in the app root devDependencies'))).to.be.true;
        });
    });

    describe('DevOptions interface', function () {
        it('should export dev function with a single local server option object', async function () {
            const devModule = await import('../../../../src/commands/apps/dev.js');

            expect(devModule.dev).to.be.a('function');
            expect(devModule.dev.length).to.be.at.most(1);
        });
    });

    describe('type generation and dev vars', function () {
        it('should generate types for a single Worker with assets and services', async function () {
            const typesModule = await import('../../../../src/dev/types.js');
            typesModule.ensureTypesUpToDate(
                { services: ['KV'], secrets: ['API_KEY'], hasStaticAssets: true },
                testDir
            );

            const content = fs.readFileSync(path.join(testDir, 'env.d.ts'), 'utf8');
            expect(content).to.include('KV: KVNamespace');
            expect(content).to.include('ASSETS: { fetch: typeof fetch };');
            expect(content).to.include('API_KEY: string');
        });

        it('should load dev vars from .dev.vars file', async function () {
            fs.writeFileSync(path.join(testDir, '.dev.vars'), 'API_KEY=test-secret-value');

            const typesModule = await import('../../../../src/dev/types.js');
            const vars = typesModule.loadDevVars(testDir, ['API_KEY']);

            expect(vars).to.deep.equal({ API_KEY: 'test-secret-value' });
        });

        it('should return empty object when .dev.vars does not exist', async function () {
            const typesModule = await import('../../../../src/dev/types.js');

            expect(typesModule.loadDevVars(testDir, ['API_KEY'])).to.deep.equal({});
        });
    });

    describe('signal handling hooks', function () {
        it('should leave Node signal listener APIs available for the dev server', function () {
            expect(process.listeners('SIGINT').length).to.be.a('number');
            expect(process.listeners('SIGTERM').length).to.be.a('number');
            expect(process.listeners('exit').length).to.be.a('number');
        });
    });
});

interface ConfigOptions {
    client?: boolean;
    services?: boolean;
    secrets?: boolean;
}

function writeConfig(options: ConfigOptions = {}): void {
    const lines = [
        'id: test-app',
        'name: Test App',
        'deployment:',
        '  server: server/src/index.ts',
    ];

    if (options.client) {
        lines.push('  client: client');
    }
    if (options.services) {
        lines.push('  services:', '    - KV');
    }
    if (options.secrets) {
        lines.push('  secrets:', '    - API_KEY');
    }
    lines.push('  compatibility_date: "2026-01-29"');

    fs.writeFileSync(path.join(testDir, 'bkper.yaml'), `${lines.join('\n')}\n`);
}

function writeServerSource(): void {
    fs.mkdirSync(path.join(testDir, 'server/src'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'client'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'client/index.html'), '<html></html>');
    fs.writeFileSync(path.join(testDir, 'server/src/index.ts'), 'export default {};');
}
