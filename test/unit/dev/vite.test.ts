import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import type { ViteDevServer } from 'vite';
import getPort from 'get-port';

const { __dirname } = getTestPaths(import.meta.url);

// Store references to functions we'll test
let createClientServer: typeof import('../../../src/dev/vite.js').createClientServer;
let stopClientServer: typeof import('../../../src/dev/vite.js').stopClientServer;
let buildClient: typeof import('../../../src/dev/vite.js').buildClient;
let getServerUrl: typeof import('../../../src/dev/vite.js').getServerUrl;

/**
 * Helper to wait for a condition with retry
 */
async function waitForServer(url: string, maxRetries = 10, delay = 100): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
            if (response.ok) return;
        } catch {
            // Server not ready yet, wait and retry
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error(`Server at ${url} did not become ready`);
}

describe('Vite Integration', function () {
    // Increase timeout for Vite operations (startup and build can be slow)
    this.timeout(30000);

    // Path to test fixture
    const fixtureRoot = path.resolve(__dirname, '../../fixtures/vite-project');

    // Temp directory for build output tests
    const tempBuildDir = path.resolve(__dirname, '../../temp/vite-build-test');

    // Track server for cleanup
    let server: ViteDevServer | null = null;

    before(async function () {
        setupTestEnvironment();
        // Import the module
        const viteModule = await import('../../../src/dev/vite.js');
        createClientServer = viteModule.createClientServer;
        stopClientServer = viteModule.stopClientServer;
        buildClient = viteModule.buildClient;
        getServerUrl = viteModule.getServerUrl;
    });

    afterEach(async function () {
        // Cleanup server after each test
        if (server) {
            await stopClientServer(server);
            server = null;
        }
    });

    after(function () {
        // Cleanup temp build directory
        if (fs.existsSync(tempBuildDir)) {
            fs.rmSync(tempBuildDir, { recursive: true });
        }
    });

    describe('createClientServer', function () {
        it('should start dev server and return ViteDevServer instance', async function () {
            const port = await getPort();
            server = await createClientServer(fixtureRoot, {
                port,
                serverPort: 8787,
            });

            expect(server).to.be.an('object');
            expect(server).to.have.property('listen');
            expect(server).to.have.property('close');
        });

        it('should respond to HTTP requests', async function () {
            const port = await getPort();
            server = await createClientServer(fixtureRoot, {
                port,
                serverPort: 8787,
            });

            const url = getServerUrl(server);
            expect(url).to.be.a('string');
            // Server binds to 127.0.0.1 for IPv4 compatibility
            expect(url).to.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/);

            // Wait for server to be fully ready
            await waitForServer(url!);

            const response = await fetch(url!);
            expect(response.ok).to.be.true;

            const html = await response.text();
            expect(html).to.include('Hello Vite!');
        });
    });

    describe('getServerUrl', function () {
        it('should return the correct URL format', async function () {
            const port = await getPort();
            server = await createClientServer(fixtureRoot, {
                port,
                serverPort: 8787,
            });

            const url = getServerUrl(server);
            expect(url).to.be.a('string');
            // Server binds to 127.0.0.1 for IPv4 compatibility
            expect(url).to.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/);
        });
    });

    describe('stopClientServer', function () {
        it('should stop the server properly', async function () {
            const port = await getPort();
            server = await createClientServer(fixtureRoot, {
                port,
                serverPort: 8787,
            });

            const url = getServerUrl(server);
            expect(url).to.be.a('string');

            // Wait for server to be fully ready
            await waitForServer(url!);

            // Verify server is running
            const responseBefore = await fetch(url!);
            expect(responseBefore.ok).to.be.true;

            // Stop the server
            await stopClientServer(server);
            server = null; // Mark as stopped for cleanup

            // Give server time to fully close
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify server is stopped (connection should fail)
            try {
                await fetch(url!, { signal: AbortSignal.timeout(1000) });
                expect.fail('Server should be stopped');
            } catch (error) {
                // Expected: connection refused or timeout
                expect(error).to.be.an('Error');
            }
        });
    });

    describe('buildClient', function () {
        it('should build client to specified output directory', async function () {
            // Clean up before test
            if (fs.existsSync(tempBuildDir)) {
                fs.rmSync(tempBuildDir, { recursive: true });
            }

            await buildClient(fixtureRoot, { outDir: tempBuildDir });

            expect(fs.existsSync(tempBuildDir)).to.be.true;
            expect(fs.existsSync(path.join(tempBuildDir, 'index.html'))).to.be.true;
        });

        it('should create assets directory with bundled JavaScript', async function () {
            // Use a different temp directory
            const buildDir = path.resolve(__dirname, '../../temp/vite-build-assets-test');

            // Clean up before test
            if (fs.existsSync(buildDir)) {
                fs.rmSync(buildDir, { recursive: true });
            }

            await buildClient(fixtureRoot, { outDir: buildDir });

            // Vite creates an assets directory for bundled files
            const assetsDir = path.join(buildDir, 'assets');
            expect(fs.existsSync(assetsDir)).to.be.true;

            // Should have at least one JS file
            const files = fs.readdirSync(assetsDir);
            const jsFiles = files.filter(f => f.endsWith('.js'));
            expect(jsFiles.length).to.be.greaterThan(0);

            // Cleanup
            fs.rmSync(buildDir, { recursive: true });
        });
    });

    describe('proxy configuration', function () {
        it('should configure proxy for /api requests', async function () {
            const port = await getPort();
            server = await createClientServer(fixtureRoot, {
                port,
                serverPort: 8787,
            });

            // Verify proxy is configured by checking server config
            // Note: We can't easily test actual proxy behavior without a running backend,
            // but we can verify the configuration exists
            const config = server.config;
            expect(config.server.proxy).to.have.property('/api');

            const apiProxy = config.server.proxy!['/api'];
            // Proxy can be string or ProxyOptions object
            if (typeof apiProxy === 'string') {
                expect(apiProxy).to.equal('http://localhost:8787');
            } else {
                expect(apiProxy).to.have.property('target');
                expect(apiProxy.target).to.equal('http://localhost:8787');
            }
        });
    });
});
