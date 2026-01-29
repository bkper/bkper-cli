import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import path from 'path';
import fs from 'fs';
import type { Miniflare } from 'miniflare';

const { __dirname } = getTestPaths(import.meta.url);

// Store reference to functions we'll test
let createWorkerServer: typeof import('../../../src/dev/miniflare.js').createWorkerServer;
let reloadWorker: typeof import('../../../src/dev/miniflare.js').reloadWorker;
let stopWorkerServer: typeof import('../../../src/dev/miniflare.js').stopWorkerServer;

describe('Miniflare Integration', function() {
    // Increase timeout for server operations
    this.timeout(30000);

    // Paths to test fixtures
    const fixturesDir = path.join(__dirname, '../../fixtures/workers');
    const simpleWorkerPath = path.join(fixturesDir, 'simple.ts');
    const withKvWorkerPath = path.join(fixturesDir, 'with-kv.ts');
    const withVarsWorkerPath = path.join(fixturesDir, 'with-vars.ts');

    // Track Miniflare instance for cleanup
    let mf: Miniflare | null = null;

    // Unique port for each test to avoid conflicts
    let testPort: number;

    before(async function() {
        setupTestEnvironment();
        // Import the module
        const miniflareModule = await import('../../../src/dev/miniflare.js');
        createWorkerServer = miniflareModule.createWorkerServer;
        reloadWorker = miniflareModule.reloadWorker;
        stopWorkerServer = miniflareModule.stopWorkerServer;
    });

    beforeEach(function() {
        // Use a unique port for each test (8800-8899 range)
        testPort = 8800 + Math.floor(Math.random() * 100);
    });

    afterEach(async function() {
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

    describe('createWorkerServer', function() {
        it('should start and return Miniflare instance', async function() {
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            expect(mf).to.be.an('object');
            expect(mf).to.have.property('ready');
        });

        it('should respond to HTTP requests', async function() {
            mf = await createWorkerServer(simpleWorkerPath, { port: testPort });

            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;

            const text = await response.text();
            expect(text).to.include('Hello');
        });

        it('should configure KV namespaces properly', async function() {
            mf = await createWorkerServer(withKvWorkerPath, {
                port: testPort,
                kvNamespaces: ['KV'],
                persist: false
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

        it('should pass custom vars/secrets to Worker', async function() {
            mf = await createWorkerServer(withVarsWorkerPath, {
                port: testPort,
                vars: { API_KEY: 'test-secret-key' }
            });

            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;

            const text = await response.text();
            expect(text).to.equal('API Key: test-secret-key');
        });

        it('should apply custom compatibility date', async function() {
            mf = await createWorkerServer(simpleWorkerPath, {
                port: testPort,
                compatibilityDate: '2024-01-01'
            });

            // Server should start successfully with custom compatibility date
            const response = await fetch(`http://localhost:${testPort}/`);
            expect(response.ok).to.be.true;
        });
    });

    describe('reloadWorker', function() {
        it('should update Worker code without restarting server', async function() {
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

    describe('stopWorkerServer', function() {
        it('should gracefully stop Miniflare instance', async function() {
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
