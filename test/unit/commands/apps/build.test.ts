import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { __dirname } = getTestPaths(import.meta.url);

// Path to CLI's node_modules/typescript (used to symlink into temp projects)
const cliRoot = path.resolve(__dirname, '../../../..');
const cliTypescriptPath = path.join(cliRoot, 'node_modules/typescript');

// Module under test - will be imported dynamically
let build: typeof import('../../../../src/commands/apps/build.js').build;

describe('CLI - apps build command', function () {
    this.timeout(30000);

    const fixturesDir = path.join(__dirname, '../../../fixtures');
    let tempDir: string;
    let originalCwd: string;

    // Console/exit mocks
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

        // Import the module
        const buildModule = await import('../../../../src/commands/apps/build.js');
        build = buildModule.build;
    });

    beforeEach(function () {
        originalCwd = process.cwd();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-'));

        // Reset capture arrays
        exitCode = undefined;
        consoleOutput = [];
        consoleErrors = [];
        consoleWarns = [];

        // Mock console
        console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
        console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));
        console.warn = (...args: unknown[]) => consoleWarns.push(args.join(' '));

        // Mock process.exit
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

        // Cleanup temp directory
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    describe('build - configuration loading', function () {
        it('should exit with error when no deployment config found', async function () {
            // Create config without deployment section
            fs.writeFileSync(path.join(tempDir, 'bkper.yaml'), 'id: test-app\nname: Test App\n');
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('No deployment configuration found'))).to.be
                .true;
        });

        it('should exit with error when no config file exists', async function () {
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('No deployment configuration found'))).to.be
                .true;
        });
    });

    describe('build - dependency preflight', function () {
        it('should exit with error when dependencies are missing', async function () {
            // Manually create config WITHOUT node_modules to trigger preflight error
            fs.writeFileSync(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            fs.writeFileSync(
                path.join(tempDir, 'bkper.yaml'),
                `id: test-app
name: Test App
deployment:
  events:
    main: src/events/index.ts
`
            );
            fs.mkdirSync(path.join(tempDir, 'src/events'), { recursive: true });
            fs.writeFileSync(
                path.join(tempDir, 'src/events/index.ts'),
                'export default { fetch() { return new Response("ok"); } };'
            );
            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('Missing dependencies'))).to.be.true;
        });

        it('should exit with error when client deps are missing', async function () {
            fs.writeFileSync(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test-app', private: true }, null, 2)
            );
            fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

            setupProjectStructure(tempDir, {
                configType: 'web-with-client',
                createSourceFiles: true,
                createViteProject: true,
            });

            const clientDir = path.join(tempDir, 'src/client');
            fs.writeFileSync(
                path.join(clientDir, 'package.json'),
                JSON.stringify(
                    { name: 'client', private: true, dependencies: { lit: '^3.3.2' } },
                    null,
                    2
                )
            );

            process.chdir(tempDir);

            try {
                await build();
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors.some(e => e.includes('Missing client dependencies'))).to.be.true;
        });
    });

    describe('build - types generation', function () {
        it('should ensure types are up to date before building', async function () {
            // Create source files and config with services/secrets
            setupProjectStructure(tempDir, {
                configType: 'events-with-services',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Check that env.d.ts was created
            expect(fs.existsSync(path.join(tempDir, 'env.d.ts'))).to.be.true;

            // Verify it contains expected content
            const envDts = fs.readFileSync(path.join(tempDir, 'env.d.ts'), 'utf8');
            expect(envDts).to.include('export interface Env');
            expect(envDts).to.include('KV: KVNamespace');
            expect(envDts).to.include('API_KEY: string');
        });
    });

    describe('build - web client', function () {
        it('should build web client when configured', async function () {
            // Create Vite project structure
            setupProjectStructure(tempDir, {
                configType: 'web-with-client',
                createSourceFiles: true,
                createViteProject: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify web client was built
            expect(fs.existsSync(path.join(tempDir, 'dist/web/client/index.html'))).to.be.true;
            expect(consoleOutput.some(o => o.includes('Web client'))).to.be.true;
        });

        it('should skip client build when only server is configured', async function () {
            setupProjectStructure(tempDir, {
                configType: 'web-server-only',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify server was built but client directory doesn't exist
            expect(fs.existsSync(path.join(tempDir, 'dist/web/server/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/web/client'))).to.be.false;
        });
    });

    describe('build - web server', function () {
        it('should build web server when configured', async function () {
            setupProjectStructure(tempDir, {
                configType: 'web-server-only',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify web server was built
            expect(fs.existsSync(path.join(tempDir, 'dist/web/server/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/web/server/index.js.map'))).to.be.true;
            expect(consoleOutput.some(o => o.includes('Web server'))).to.be.true;
        });
    });

    describe('build - events handler', function () {
        it('should build events handler when configured', async function () {
            setupProjectStructure(tempDir, {
                configType: 'events-only',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify events handler was built
            expect(fs.existsSync(path.join(tempDir, 'dist/events/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/events/index.js.map'))).to.be.true;
            expect(consoleOutput.some(o => o.includes('Events'))).to.be.true;
        });

        it('should skip events build if not configured', async function () {
            setupProjectStructure(tempDir, {
                configType: 'web-server-only',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify events directory doesn't exist
            expect(fs.existsSync(path.join(tempDir, 'dist/events'))).to.be.false;
        });
    });

    describe('build - output directories', function () {
        it('should create output directories if they do not exist', async function () {
            setupProjectStructure(tempDir, {
                configType: 'full',
                createSourceFiles: true,
                createViteProject: true,
            });
            process.chdir(tempDir);

            // Ensure dist doesn't exist
            expect(fs.existsSync(path.join(tempDir, 'dist'))).to.be.false;

            await build();

            // Verify all directories were created
            expect(fs.existsSync(path.join(tempDir, 'dist/web/server'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/web/client'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/events'))).to.be.true;
        });
    });

    describe('build - file sizes', function () {
        it('should report file sizes in output', async function () {
            setupProjectStructure(tempDir, {
                configType: 'events-only',
                createSourceFiles: true,
            });
            process.chdir(tempDir);

            await build();

            // Check that size information is displayed
            const outputWithEvents = consoleOutput.find(o => o.includes('Events'));
            expect(outputWithEvents).to.not.be.undefined;
            // Should contain size in B, KB, or MB
            expect(outputWithEvents).to.match(/\d+(\.\d+)?\s*(B|KB|MB)/);
        });
    });

    describe('build - full build', function () {
        it('should build all configured handlers', async function () {
            setupProjectStructure(tempDir, {
                configType: 'full',
                createSourceFiles: true,
                createViteProject: true,
            });
            process.chdir(tempDir);

            await build();

            // Verify all outputs exist
            expect(fs.existsSync(path.join(tempDir, 'dist/web/server/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/web/client/index.html'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'dist/events/index.js'))).to.be.true;

            // Verify completion message
            expect(consoleOutput.some(o => o.includes('Build complete'))).to.be.true;
        });
    });

    describe('build - shared package', function () {
        it('should build shared package before handlers', async function () {
            setupProjectStructure(tempDir, {
                configType: 'events-only',
                createSourceFiles: true,
                createSharedPackage: true,
            });
            process.chdir(tempDir);

            await build();

            expect(fs.existsSync(path.join(tempDir, 'packages/shared/dist/index.js'))).to.be.true;
            expect(fs.existsSync(path.join(tempDir, 'packages/shared/dist/index.d.ts'))).to.be.true;
            expect(consoleOutput.some(o => o.includes('Shared package'))).to.be.true;
        });
    });
});

/**
 * Configuration types for test projects
 */
type ConfigType =
    | 'full'
    | 'web-with-client'
    | 'web-server-only'
    | 'events-only'
    | 'events-with-services';

interface SetupOptions {
    configType: ConfigType;
    createSourceFiles?: boolean;
    createViteProject?: boolean;
    createSharedPackage?: boolean;
}

/**
 * Helper to setup a project structure for testing
 */
function setupProjectStructure(tempDir: string, options: SetupOptions): void {
    const { configType, createSourceFiles, createViteProject, createSharedPackage } = options;

    // Create package.json (required by preflight)
    fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-app', private: true }, null, 2)
    );

    // Create node_modules (required by preflight)
    const nodeModulesPath = path.join(tempDir, 'node_modules');
    fs.mkdirSync(nodeModulesPath, { recursive: true });

    // Create appropriate bkper.yaml based on config type
    const configs: Record<ConfigType, string> = {
        full: `
id: test-app
name: Test App
deployment:
  web:
    main: src/server/index.ts
    client: src/client
  events:
    main: src/events/index.ts
  services:
    - KV
  secrets:
    - API_KEY
`,
        'web-with-client': `
id: test-app
name: Test App
deployment:
  web:
    main: src/server/index.ts
    client: src/client
`,
        'web-server-only': `
id: test-app
name: Test App
deployment:
  web:
    main: src/server/index.ts
`,
        'events-only': `
id: test-app
name: Test App
deployment:
  events:
    main: src/events/index.ts
`,
        'events-with-services': `
id: test-app
name: Test App
deployment:
  events:
    main: src/events/index.ts
  services:
    - KV
  secrets:
    - API_KEY
`,
    };

    fs.writeFileSync(path.join(tempDir, 'bkper.yaml'), configs[configType]);

    if (createSourceFiles) {
        // Create worker source files
        const workerCode = `export default {
    async fetch(request: Request): Promise<Response> {
        return new Response("Hello from Worker!");
    }
};
`;

        if (configType !== 'events-only') {
            fs.mkdirSync(path.join(tempDir, 'src/server'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, 'src/server/index.ts'), workerCode);
        }

        if (
            configType === 'full' ||
            configType === 'events-only' ||
            configType === 'events-with-services'
        ) {
            fs.mkdirSync(path.join(tempDir, 'src/events'), { recursive: true });
            fs.writeFileSync(path.join(tempDir, 'src/events/index.ts'), workerCode);
        }
    }

    if (createViteProject && (configType === 'full' || configType === 'web-with-client')) {
        // Create minimal Vite project structure
        fs.mkdirSync(path.join(tempDir, 'src/client/src'), { recursive: true });
        fs.writeFileSync(
            path.join(tempDir, 'src/client/index.html'),
            `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
</body>
</html>`
        );
        fs.writeFileSync(
            path.join(tempDir, 'src/client/src/main.ts'),
            `document.getElementById('app')!.innerHTML = '<h1>Hello</h1>';`
        );
    }

    if (createSharedPackage) {
        // Symlink TypeScript from CLI's node_modules (required for shared package build)
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
}
