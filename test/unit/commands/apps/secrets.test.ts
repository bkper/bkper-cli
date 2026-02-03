import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';

const { __dirname } = getTestPaths(import.meta.url);

// Temp directory for test app config
const testDir = path.join(__dirname, '../../fixtures/temp-secrets-test');

/**
 * These tests verify the error handling paths for the secrets commands.
 * The actual API calls would require integration tests with the Platform API.
 */
describe('CLI - apps secrets Commands', function () {
    const originalCwd = process.cwd();
    const originalExit = process.exit;
    let exitCode: number | undefined;
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Store references to the functions we'll test
    let secretsPut: typeof import('../../../../src/commands/apps/index.js').secretsPut;
    let secretsList: typeof import('../../../../src/commands/apps/index.js').secretsList;
    let secretsDelete: typeof import('../../../../src/commands/apps/index.js').secretsDelete;

    before(async function () {
        // Import the functions
        const apps = await import('../../../../src/commands/apps/index.js');
        secretsPut = apps.secretsPut;
        secretsList = apps.secretsList;
        secretsDelete = apps.secretsDelete;
    });

    beforeEach(function () {
        setupTestEnvironment();
        exitCode = undefined;
        consoleOutput = [];
        consoleErrors = [];

        // Mock console
        console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
        console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));

        // Mock process.exit
        process.exit = ((code?: number) => {
            exitCode = code;
            throw new Error(`process.exit(${code})`);
        }) as never;

        // Create temp directory with app config
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'id: test-app\nname: Test App\n');
        process.chdir(testDir);
    });

    afterEach(function () {
        process.chdir(originalCwd);
        process.exit = originalExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        // Cleanup temp directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    describe('secretsPut - Config Loading', function () {
        it('should exit with error when app config is missing', async function () {
            fs.unlinkSync(path.join(testDir, 'bkperapp.yaml'));

            try {
                await secretsPut('SECRET', {});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: bkper.yaml or bkper.json not found');
        });

        it('should exit with error when app config has no id', async function () {
            fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'name: Test App Without ID\n');

            try {
                await secretsPut('SECRET', {});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: App config is missing "id" field');
        });
    });

    describe('secretsList - Config Loading', function () {
        it('should exit with error when app config is missing', async function () {
            fs.unlinkSync(path.join(testDir, 'bkperapp.yaml'));

            try {
                await secretsList({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: bkper.yaml or bkper.json not found');
        });

        it('should exit with error when app config has no id', async function () {
            fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'name: Test App Without ID\n');

            try {
                await secretsList({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: App config is missing "id" field');
        });
    });

    describe('secretsDelete - Config Loading', function () {
        it('should exit with error when app config is missing', async function () {
            fs.unlinkSync(path.join(testDir, 'bkperapp.yaml'));

            try {
                await secretsDelete('SECRET', {});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: bkper.yaml or bkper.json not found');
        });

        it('should exit with error when app config has no id', async function () {
            fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'name: Test App Without ID\n');

            try {
                await secretsDelete('SECRET', {});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: App config is missing "id" field');
        });
    });

    describe('Function exports', function () {
        it('should export secretsPut function', function () {
            expect(secretsPut).to.be.a('function');
        });

        it('should export secretsList function', function () {
            expect(secretsList).to.be.a('function');
        });

        it('should export secretsDelete function', function () {
            expect(secretsDelete).to.be.a('function');
        });
    });
});
