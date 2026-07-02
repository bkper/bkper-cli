import { expect, getTestPaths } from '../helpers/test-setup.js';

getTestPaths(import.meta.url);

describe('Logger Module', function () {
    let createLogger: typeof import('../../../src/dev/logger.js').createLogger;
    let formatSize: typeof import('../../../src/dev/logger.js').formatSize;
    let logDevServerBanner: typeof import('../../../src/dev/logger.js').logDevServerBanner;
    let logBuildResults: typeof import('../../../src/dev/logger.js').logBuildResults;

    let consoleOutput: string[];
    let consoleErrors: string[];
    let consoleWarns: string[];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    before(async function () {
        const loggerModule = await import('../../../src/dev/logger.js');
        createLogger = loggerModule.createLogger;
        formatSize = loggerModule.formatSize;
        logDevServerBanner = loggerModule.logDevServerBanner;
        logBuildResults = loggerModule.logBuildResults;
    });

    beforeEach(function () {
        consoleOutput = [];
        consoleErrors = [];
        consoleWarns = [];
        console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
        console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));
        console.warn = (...args: unknown[]) => consoleWarns.push(args.join(' '));
    });

    afterEach(function () {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
    });

    describe('createLogger', function () {
        it('should prefix messages correctly', function () {
            const logger = createLogger('server');

            logger.info('Starting server...');
            logger.success('Server started');
            logger.warn('Warning message');
            logger.error('Error message');
            logger.debug('Debug message');

            expect(consoleOutput[0]).to.equal('[server] Starting server...');
            expect(consoleOutput[1]).to.include('[server] ✅ Server started');
            expect(consoleWarns[0]).to.include('[server] ⚠️  Warning message');
            expect(consoleErrors[0]).to.include('[server] ❌ Error message');
            expect(consoleOutput[2]).to.equal('[server] Debug message');
        });

        it('should work with all current prefixes', function () {
            const prefixes = ['server', 'client', 'build', 'types', 'shared'] as const;

            for (const prefix of prefixes) {
                const logger = createLogger(prefix);
                logger.info('test');
            }

            expect(consoleOutput).to.have.length(5);
            expect(consoleOutput[0]).to.include('[server]');
            expect(consoleOutput[4]).to.include('[shared]');
        });
    });

    describe('formatSize', function () {
        it('should format bytes less than 1KB', function () {
            expect(formatSize(0)).to.equal('0 B');
            expect(formatSize(512)).to.equal('512 B');
            expect(formatSize(1023)).to.equal('1023 B');
        });

        it('should format bytes as KB', function () {
            expect(formatSize(1024)).to.equal('1.0 KB');
            expect(formatSize(1536)).to.equal('1.5 KB');
            expect(formatSize(1024 * 1023)).to.equal('1023.0 KB');
        });

        it('should format bytes as MB', function () {
            expect(formatSize(1024 * 1024)).to.equal('1.0 MB');
            expect(formatSize(1024 * 1024 * 2.5)).to.equal('2.5 MB');
        });
    });

    describe('logDevServerBanner', function () {
        it('should log browser app and Worker URLs with tunnel URL', function () {
            logDevServerBanner({
                clientUrl: 'http://localhost:5173',
                workerUrl: 'http://127.0.0.1:8787',
                tunnelUrl: 'https://abc.trycloudflare.com/events',
            });

            const allOutput = consoleOutput.join('\n');
            expect(allOutput).to.include('Bkper App Development Server');
            expect(allOutput).to.include('Open app:');
            expect(allOutput).to.include('http://localhost:5173');
            expect(allOutput).to.include('Worker/API:');
            expect(allOutput).to.include('http://127.0.0.1:8787');
            expect(allOutput).to.include('https://abc.trycloudflare.com/events');
            expect(allOutput).to.include('Open the app URL in your browser');
            expect(allOutput).to.include('Press Ctrl+C to stop');
        });

        it('should handle missing tunnelUrl', function () {
            logDevServerBanner({ workerUrl: 'http://127.0.0.1:8787' });

            const allOutput = consoleOutput.join('\n');
            expect(allOutput).to.include('Bkper App Development Server');
            expect(allOutput).to.include('Worker/API:');
            expect(allOutput).to.not.include('Events:');
        });
    });

    describe('logBuildResults', function () {
        it('should log server Worker build results with sizes', function () {
            logBuildResults({ server: { path: 'dist/server/', size: 23552 } });

            const allOutput = consoleOutput.join('\n');
            expect(allOutput).to.include('Building Bkper App');
            expect(allOutput).to.include('Server worker');
            expect(allOutput).to.include('dist/server/');
            expect(allOutput).to.include('23.0 KB');
            expect(allOutput).to.include('Build complete');
        });

        it('should handle empty results', function () {
            logBuildResults({});

            const allOutput = consoleOutput.join('\n');
            expect(allOutput).to.include('Building Bkper App');
            expect(allOutput).to.include('Build complete');
        });
    });
});
