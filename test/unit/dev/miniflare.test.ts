import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import path from 'path';
import fs from 'fs';
import type { Miniflare } from 'miniflare';

const { __dirname } = getTestPaths(import.meta.url);

// Store reference to functions we'll test
let createWorkerServer: typeof import('../../../src/dev/miniflare.js').createWorkerServer;
let reloadWorker: typeof import('../../../src/dev/miniflare.js').reloadWorker;
let stopWorkerServer: typeof import('../../../src/dev/miniflare.js').stopWorkerServer;

describe('Miniflare Integration', function () {
    // Increase timeout for server operations
    this.timeout(30000);

    // Paths to test fixtures
    const fixturesDir = path.join(__dirname, '../../fixtures/workers');
    const simpleWorkerPath = path.join(fixturesDir, 'simple.ts');
    const withKvWorkerPath = path.join(fixturesDir, 'with-kv.ts');
    const withVarsWorkerPath = path.join(fixturesDir, 'with-vars.ts');
    const withAssetsWorkerPath = path.join(fixturesDir, 'with-assets.ts');
    const fetchExternalWorkerPath = path.join(fixturesDir, 'fetch-external.ts');
    const headersWorkerPath = path.join(fixturesDir, 'headers.ts');

    // Track Miniflare instance for cleanup
    let mf: Miniflare | null = null;

    // Unique port for each test to avoid conflicts
    let testPort: number;

    before(async function () {
        setupTestEnvironment();
        // Import the module
        const miniflareModule = await import('../../../src/dev/miniflare.js');
        createWorkerServer = miniflareModule.createWorkerServer;
        reloadWorker = miniflareModule.reloadWorker;
        stopWorkerServer = miniflareModule.stopWorkerServer;
    });

    beforeEach(function () {
        // Use a unique port for each test (8800-8899 range)
        testPort = 8800 + Math.floor(Math.random() * 100);
    });

    afterEach(async function () {
        // Clean up Miniflare instance after each test
        if (mf) {
            await stopWorkerServer(mf);
            mf = null;
        }
        // Clean up persist directory if created
        const persistDir = path.join(process.cwd(), '.mf');
        if (fs.existsSync(persistDir)) {
            fs.rmSync(persistDir, { recursive: true });
        }
    });

    describe('createWorkerServer', function () {
        it('should start and return Miniflare instance', async function () {
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            expect(mf).to.be.an('object');
            expect(mf).to.have.property('ready');
        });

        it('should respond to HTTP requests', async function () {
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;

            const text = await response.text();
            expect(text).to.include('Hello');
        });

        it('should configure KV namespaces properly', async function () {
            mf = await createWorkerServer(withKvWorkerPath, {
                port: testPort,
                kvNamespaces: ['KV'],
                persist: false,
            });

            // Set a value in KV
            const setResponse = await fetch(`http://localhost:${testPort}/set`);
            expect(setResponse.ok).to.be.true;
            const setText = await setResponse.text();
            expect(setText).to.equal('Set');

            // Get the value back
            const getResponse = await fetch(`http://localhost:${testPort}/get`);
            expect(getResponse.ok).to.be.true;
            const getValue = await getResponse.text();
            expect(getValue).to.equal('Value: value');
        });

        it('should pass custom vars/secrets to Worker', async function () {
            mf = await createWorkerServer(withVarsWorkerPath, {
                port: testPort,
                vars: { API_KEY: 'test-secret-key' },
            });

            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;

            const text = await response.text();
            expect(text).to.equal('API Key: test-secret-key');
        });

        it('should apply custom compatibility date', async function () {
            mf = await createWorkerServer(simpleWorkerPath, {
                port: testPort,
                compatibilityDate: '2024-01-01',
            });

            // Server should start successfully with custom compatibility date
            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;
        });

        it('should bind a local ASSETS service when configured', async function () {
            const assetRequests: Request[] = [];
            mf = await createWorkerServer(withAssetsWorkerPath, {
                port: testPort,
                assetsService: async request => {
                    assetRequests.push(request);
                    return new Response(`asset:${new URL(request.url).pathname}`, { status: 203 });
                },
            });

            const response = await fetch(`http://localhost:${testPort}/client/path`);
            const text = await response.text();

            expect(response.status).to.equal(203);
            expect(text).to.equal('asset:/client/path');
            expect(assetRequests).to.have.length(1);
            expect(assetRequests[0].url).to.equal(`http://localhost:${testPort}/client/path`);
        });

        it('should route Worker outbound fetches through a configured outbound service', async function () {
            const outboundRequests: Request[] = [];
            mf = await createWorkerServer(fetchExternalWorkerPath, {
                port: testPort,
                outboundService: async request => {
                    outboundRequests.push(request);
                    return new Response('from outbound', { status: 201 });
                },
            });

            const response = await fetch(`http://localhost:${testPort}/`);
            const text = await response.text();

            expect(response.status).to.equal(201);
            expect(text).to.equal('from outbound');
            expect(outboundRequests).to.have.length(1);
            expect(outboundRequests[0].url).to.equal('https://api.bkper.app/v5/books');
        });

        it('should strip platform credentials before app Worker code runs', async function () {
            mf = await createWorkerServer(headersWorkerPath, { port: testPort });

            const response = await fetch(`http://localhost:${testPort}/`, {
                headers: {
                    Authorization: 'Bearer user-token',
                    'bkper-oauth-token': 'event-token',
                    'bkper-agent-id': 'other-app',
                    Cookie: 'bkper_session=platform; app_cookie=app; bkper_session_dev=dev',
                    'x-app-header': 'visible',
                },
            });
            const body = await response.json();

            expect(response.ok).to.be.true;
            expect(body).to.deep.equal({
                authorization: null,
                bkperOauthToken: null,
                bkperAgentId: null,
                cookie: 'app_cookie=app',
                customHeader: 'visible',
            });
        });

        it('should redirect browser navigation from Worker root to the client dev server', async function () {
            mf = await createWorkerServer(simpleWorkerPath, {
                port: testPort,
                clientOrigin: 'http://localhost:5173',
            });

            const response = await fetch(`http://localhost:${testPort}/?bookId=book-1`, {
                headers: { Accept: 'text/html' },
                redirect: 'manual',
            });

            expect(response.status).to.equal(302);
            expect(response.headers.get('location')).to.equal(
                'http://localhost:5173/?bookId=book-1'
            );
        });

        it('should keep Worker endpoints on the Worker port when client redirect is configured', async function () {
            mf = await createWorkerServer(simpleWorkerPath, {
                port: testPort,
                clientOrigin: 'http://localhost:5173',
            });

            const response = await fetch(`http://localhost:${testPort}/health`, {
                headers: { Accept: 'text/html' },
                redirect: 'manual',
            });

            expect(response.status).to.equal(200);
            expect(response.headers.get('location')).to.equal(null);
            expect(await response.text()).to.equal('Hello from Worker!');
        });
    });

    describe('reloadWorker', function () {
        it('should update Worker code without restarting server', async function () {
            // Start with simple worker
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            // Verify initial response
            const response1 = await fetch(`http://localhost:${testPort}/`);
            const text1 = await response1.text();
            expect(text1).to.include('Hello');

            // Reload with vars worker (different response)
            await reloadWorker(mf, withVarsWorkerPath);

            // Verify updated response
            const response2 = await fetch(`http://localhost:${testPort}/`);
            const text2 = await response2.text();
            expect(text2).to.include('API Key');
        });
    });

    describe('stopWorkerServer', function () {
        it('should gracefully stop Miniflare instance', async function () {
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            // Verify server is running
            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;

            // Stop the server
            await stopWorkerServer(mf);
            mf = null; // Mark as stopped to prevent double cleanup

            // Server should no longer respond
            try {
                await fetch(`http://localhost:${testPort}/`, { signal: AbortSignal.timeout(1000) });
                expect.fail('Server should have stopped');
            } catch (error) {
                // Expected - connection refused or timeout
                expect(error).to.be.an('Error');
            }
        });
    });
});
