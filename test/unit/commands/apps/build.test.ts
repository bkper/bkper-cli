import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { __dirname } = getTestPaths(import.meta.url);
const cliRoot = path.resolve(__dirname, '../../../..');
const cliTypescriptPath = path.join(cliRoot, 'node_modules/typescript');

let build: typeof import('../../../../src/commands/apps/build.js').build;

describe('CLI - apps build command', function () {
    this.timeout(30000);

    let tempDir: string;
    let originalCwd: string;

    const originalExit = process.exit;
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    let exitCode: number | undefined;
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    let consoleWarns: string[] = [];

    before(async function () {
        setupTestEnvironment();
        const buildModule = await import('../../../../src/commands/apps/build.js');
        build = buildModule.build;
    });

    beforeEach(function () {
        originalCwd = process.cwd();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-'));
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
    });

    afterEach(function () {
        process.chdir(originalCwd);
        process.exit = originalExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;

        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    describe('configuration loading', function () {
        it('should exit with error when no deployment config found', async function () {
            fs.writeFileSync(path.join(tempDir, 'bkper.yaml'), 'id: test-app\nname: Test App\n');
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('No deployment configuration found'))).to.be.true;
        });

        it('should exit with error when no config file exists', async function () {
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('No deployment configuration found'))).to.be.true;
        });
    });

    describe('dependency preflight', function () {
        it('should exit with error when dependencies are missing', async function () {
            fs.writeFileSync(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            writeConfig(tempDir, { client: false });
            writeServerSource(tempDir);
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('Missing dependencies'))).to.be.true;
        });
    });

    describe('types generation', function () {
        it('should ensure types are up to date before building', async function () {
            setupProjectStructure(tempDir, { client: true, services: true, secrets: true });
            process.chdir(tempDir);

            await build();

            const envDts = fs.readFileSync(path.join(tempDir, 'env.d.ts'), 'utf8');
            expect(envDts).to.include('export interface Env');
            expect(envDts).to.include('KV: KVNamespace');
            expect(envDts).to.include('ASSETS: { fetch: typeof fetch };');
            expect(envDts).to.include('API_KEY: string');
        });
    });

    describe('server Worker build', function () {
        it('should build the single server Worker when configured', async function () {
            setupProjectStructure(tempDir, { client: true });
            process.chdir(tempDir);

            await build();

            expect(fs.existsSync(path.join(tempDir, 'dist/server/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/server/index.js.map'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/events'))).to.be.false;
            expect(fs.existsSync(path.join(tempDir, 'dist/web'))).to.be.false;
            expect(consoleOutput.some(o => o.includes('Server worker'))).to.be.true;
        });

        it('should report server file size in output', async function () {
            setupProjectStructure(tempDir, { client: false });
            process.chdir(tempDir);

            await build();

            const output = consoleOutput.find(o => o.includes('Server worker'));
            expect(output).to.not.be.undefined;
            expect(output).to.match(/\d+(\.\d+)?\s*(B|KB|MB)/);
        });

        it('should build a shared package before the server Worker when present', async function () {
            setupProjectStructure(tempDir, { client: false, createSharedPackage: true });
            process.chdir(tempDir);

            await build();

            expect(fs.existsSync(path.join(tempDir, 'packages/shared/dist/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'packages/shared/dist/index.d.ts'))).to.be.true;
            expect(consoleOutput.some(o => o.includes('Shared package'))).to.be.true;
        });
    });
});

interface SetupOptions {
    client: boolean;
    services?: boolean;
    secrets?: boolean;
    createSharedPackage?: boolean;
}

function setupProjectStructure(tempDir: string, options: SetupOptions): void {
    fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-app', private: true }, null, 2)
    );
    fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
    writeConfig(tempDir, options);
    writeServerSource(tempDir);
    if (options.client) {
        fs.mkdirSync(path.join(tempDir, 'client'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'client/index.html'), '<html></html>');
    }
    if (options.createSharedPackage) {
        createSharedPackage(tempDir);
    }
}

function writeConfig(tempDir: string, options: Omit<SetupOptions, 'createSharedPackage'>): void {
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

    fs.writeFileSync(path.join(tempDir, 'bkper.yaml'), `${lines.join('\n')}\n`);
}

function writeServerSource(tempDir: string): void {
    fs.mkdirSync(path.join(tempDir, 'server/src'), { recursive: true });
    fs.writeFileSync(
        path.join(tempDir, 'server/src/index.ts'),
        `export default {
    async fetch(): Promise<Response> {
        return new Response("Hello from Worker!");
    }
};
`
    );
}

function createSharedPackage(tempDir: string): void {
    const tsSymlinkPath = path.join(tempDir, 'node_modules/typescript');
    if (!fs.existsSync(tsSymlinkPath)) {
        fs.symlinkSync(cliTypescriptPath, tsSymlinkPath, 'dir');
    }

    const sharedDir = path.join(tempDir, 'packages/shared');
    const sharedSrcDir = path.join(sharedDir, 'src');
    fs.mkdirSync(sharedSrcDir, { recursive: true });
    fs.writeFileSync(
        path.join(sharedDir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'bundler',
                    declaration: true,
                    outDir: 'dist',
                    rootDir: 'src',
                },
                include: ['src/**/*'],
            },
            null,
            2
        )
    );
    fs.writeFileSync(path.join(sharedSrcDir, 'index.ts'), 'export const sharedValue = 42;\n');
}
