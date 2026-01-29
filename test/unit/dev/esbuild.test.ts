import { expect, setupTestEnvironment, getTestPaths } from '../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { __dirname } = getTestPaths(import.meta.url);

// Store reference to functions we'll test
let buildWorker: typeof import('../../../src/dev/esbuild.js').buildWorker;
let buildWorkerToFile: typeof import('../../../src/dev/esbuild.js').buildWorkerToFile;
let workersExternalsPlugin: typeof import('../../../src/dev/esbuild.js').workersExternalsPlugin;

describe('esbuild - Worker Bundling Utilities', function() {
    // Increase timeout for build operations
    this.timeout(10000);

    // Paths to test fixtures
    const fixturesDir = path.join(__dirname, '../../fixtures/workers');
    const simpleWorkerPath = path.join(fixturesDir, 'simple.ts');
    const withImportsWorkerPath = path.join(fixturesDir, 'with-imports.ts');

    // Temp directory for file output tests
    let tempDir: string;

    before(async function() {
        setupTestEnvironment();
        // Import the module
        const esbuildModule = await import('../../../src/dev/esbuild.js');
        buildWorker = esbuildModule.buildWorker;
        buildWorkerToFile = esbuildModule.buildWorkerToFile;
        workersExternalsPlugin = esbuildModule.workersExternalsPlugin;
    });

    beforeEach(function() {
        // Create temp directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbuild-test-'));
    });

    afterEach(function() {
        // Cleanup temp directory
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    describe('workersExternalsPlugin', function() {
        it('should export workersExternalsPlugin', function() {
            expect(workersExternalsPlugin).to.be.an('object');
            expect(workersExternalsPlugin.name).to.equal('workers-externals');
            expect(workersExternalsPlugin.setup).to.be.a('function');
        });
    });

    describe('buildWorker', function() {
        it('should return valid JavaScript string', async function() {
            const result = await buildWorker(simpleWorkerPath);

            expect(result).to.be.a('string');
            expect(result.length).to.be.greaterThan(0);
            // Should contain the response text from our worker
            expect(result).to.include('Hello from Worker!');
        });

        it('should handle TypeScript entry point', async function() {
            const result = await buildWorker(simpleWorkerPath);

            expect(result).to.be.a('string');
            // Should be valid JavaScript (not contain TypeScript syntax)
            expect(result).to.not.include(': Response');
            expect(result).to.not.include(': Request');
        });

        it('should produce ES modules format', async function() {
            const result = await buildWorker(simpleWorkerPath);

            // ESM format should have export default
            expect(result).to.include('export');
        });

        it('should externalize cloudflare:* imports', async function() {
            const result = await buildWorker(withImportsWorkerPath);

            expect(result).to.be.a('string');
            // The import should remain as external (not bundled)
            // When externalized, the import statement is preserved
            expect(result).to.include('cloudflare:workers');
        });

        it('should externalize node:* imports', async function() {
            const result = await buildWorker(withImportsWorkerPath);

            expect(result).to.be.a('string');
            // The import should remain as external (not bundled)
            expect(result).to.include('node:buffer');
        });

        it('should throw error for invalid entry point', async function() {
            const invalidPath = path.join(fixturesDir, 'nonexistent.ts');

            try {
                await buildWorker(invalidPath);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.an('Error');
            }
        });
    });

    describe('buildWorkerToFile', function() {
        it('should create output file', async function() {
            const outfile = path.join(tempDir, 'output.js');

            await buildWorkerToFile(simpleWorkerPath, outfile);

            expect(fs.existsSync(outfile)).to.be.true;
            const content = fs.readFileSync(outfile, 'utf-8');
            expect(content).to.include('Hello from Worker!');
        });

        it('should create sourcemap file', async function() {
            const outfile = path.join(tempDir, 'output.js');

            await buildWorkerToFile(simpleWorkerPath, outfile);

            const sourcemapPath = outfile + '.map';
            expect(fs.existsSync(sourcemapPath)).to.be.true;

            // Verify it's valid JSON
            const sourcemapContent = fs.readFileSync(sourcemapPath, 'utf-8');
            const sourcemap = JSON.parse(sourcemapContent);
            expect(sourcemap).to.have.property('version', 3);
            expect(sourcemap).to.have.property('sources');
        });

        it('should throw error for invalid entry point', async function() {
            const invalidPath = path.join(fixturesDir, 'nonexistent.ts');
            const outfile = path.join(tempDir, 'output.js');

            try {
                await buildWorkerToFile(invalidPath, outfile);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.an('Error');
            }
        });

        it('should create parent directories if needed', async function() {
            const outfile = path.join(tempDir, 'nested', 'dir', 'output.js');

            await buildWorkerToFile(simpleWorkerPath, outfile);

            expect(fs.existsSync(outfile)).to.be.true;
        });
    });
});
