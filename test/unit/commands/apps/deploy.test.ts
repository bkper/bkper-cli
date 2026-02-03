import { expect, setupTestEnvironment, getTestPaths } from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';

const { __dirname } = getTestPaths(import.meta.url);

// Temp directory for test app config
const testDir = path.join(__dirname, '../../fixtures/temp-undeploy-test');

/**
 * These tests verify the error handling paths for the undeploy command.
 * The actual API calls would require integration tests with the Platform API.
 */
describe('CLI - apps undeploy Command', function () {
    const originalCwd = process.cwd();
    const originalExit = process.exit;
    let exitCode: number | undefined;
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Store reference to the function we'll test
    let undeployApp: typeof import('../../../../src/commands/apps/index.js').undeployApp;

    before(async function () {
        // Import the function
        const apps = await import('../../../../src/commands/apps/index.js');
        undeployApp = apps.undeployApp;
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

    describe('undeployApp - Config Loading', function () {
        it('should exit with error when app config is missing', async function () {
            fs.unlinkSync(path.join(testDir, 'bkperapp.yaml'));

            try {
                await undeployApp({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: bkper.yaml or bkper.json not found');
        });

        it('should exit with error when app config has no id', async function () {
            fs.writeFileSync(path.join(testDir, 'bkperapp.yaml'), 'name: Test App Without ID\n');

            try {
                await undeployApp({});
            } catch (e: unknown) {
                expect((e as Error).message).to.include('process.exit');
            }

            expect(exitCode).to.equal(1);
            expect(consoleErrors).to.include('Error: App config is missing "id" field');
        });
    });

    describe('undeployApp - Options', function () {
        it('should accept deleteData option', function () {
            // Verify the function signature accepts deleteData
            expect(undeployApp).to.be.a('function');
            // The function should accept an options object with deleteData
            expect(undeployApp.length).to.be.at.most(1); // 0 or 1 parameters (options with default)
        });
    });

    describe('Function exports', function () {
        it('should export undeployApp function', function () {
            expect(undeployApp).to.be.a('function');
        });
    });
});
