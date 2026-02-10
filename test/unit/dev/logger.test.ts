import { expect } from 'chai';
import * as sinon from 'sinon';

// Import types for stubs - implementation will be imported after stubs are created
import type { Logger, LogPrefix } from '../../../src/dev/logger.js';

describe('Logger Module', function () {
    let consoleLogStub: sinon.SinonStub;
    let consoleWarnStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;

    // Dynamic imports to allow module to be loaded after stubs are set up
    let createLogger: (prefix: LogPrefix) => Logger;
    let logDevServerBanner: (options: {
        clientUrl?: string;
        serverUrl?: string;
        eventsUrl?: string;
    }) => void;
    let logBuildResults: (results: {
        webClient?: { path: string; size: number };
        webServer?: { path: string; size: number };
        events?: { path: string; size: number };
    }) => void;
    let formatSize: (bytes: number) => string;

    before(async function () {
        // Import the module
        const loggerModule = await import('../../../src/dev/logger.js');
        createLogger = loggerModule.createLogger;
        logDevServerBanner = loggerModule.logDevServerBanner;
        logBuildResults = loggerModule.logBuildResults;
        formatSize = loggerModule.formatSize;
    });

    beforeEach(function () {
        consoleLogStub = sinon.stub(console, 'log');
        consoleWarnStub = sinon.stub(console, 'warn');
        consoleErrorStub = sinon.stub(console, 'error');
    });

    afterEach(function () {
        consoleLogStub.restore();
        consoleWarnStub.restore();
        consoleErrorStub.restore();
    });

    describe('createLogger', function () {
        it('should return a logger with correct prefix for "server"', function () {
            const logger = createLogger('server');

            expect(logger).to.have.property('info');
            expect(logger).to.have.property('success');
            expect(logger).to.have.property('warn');
            expect(logger).to.have.property('error');
            expect(logger).to.have.property('debug');
        });

        it('should prefix info messages correctly', function () {
            const logger = createLogger('server');
            logger.info('test message');

            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.firstCall.args[0]).to.equal('[server] test message');
        });

        it('should prefix success messages with checkmark icon', function () {
            const logger = createLogger('events');
            logger.success('Deployed');

            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.firstCall.args[0]).to.include('[events]');
            expect(consoleLogStub.firstCall.args[0]).to.include('Deployed');
        });

        it('should prefix warn messages with warning icon', function () {
            const logger = createLogger('types');
            logger.warn('env.d.ts is out of sync');

            expect(consoleWarnStub.calledOnce).to.be.true;
            expect(consoleWarnStub.firstCall.args[0]).to.include('[types]');
            expect(consoleWarnStub.firstCall.args[0]).to.include('env.d.ts is out of sync');
        });

        it('should prefix error messages with error icon', function () {
            const logger = createLogger('build');
            logger.error('Build failed');

            expect(consoleErrorStub.calledOnce).to.be.true;
            expect(consoleErrorStub.firstCall.args[0]).to.include('[build]');
            expect(consoleErrorStub.firstCall.args[0]).to.include('Build failed');
        });

        it('should handle debug messages', function () {
            const logger = createLogger('client');
            logger.debug('Debug info');

            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.firstCall.args[0]).to.include('[client]');
            expect(consoleLogStub.firstCall.args[0]).to.include('Debug info');
        });

        it('should work with all valid prefixes', function () {
            const prefixes: LogPrefix[] = [
                'server',
                'events',
                'client',
                'build',
                'types',
                'shared',
            ];

            prefixes.forEach(prefix => {
                const logger = createLogger(prefix);
                expect(logger).to.have.property('info');
            });
        });
    });

    describe('formatSize', function () {
        it('should format bytes less than 1KB', function () {
            expect(formatSize(500)).to.equal('500 B');
            expect(formatSize(0)).to.equal('0 B');
            expect(formatSize(1023)).to.equal('1023 B');
        });

        it('should format bytes as KB', function () {
            expect(formatSize(1024)).to.equal('1.0 KB');
            expect(formatSize(1536)).to.equal('1.5 KB');
            expect(formatSize(145000)).to.equal('141.6 KB');
        });

        it('should format bytes as MB', function () {
            expect(formatSize(1048576)).to.equal('1.0 MB');
            expect(formatSize(1572864)).to.equal('1.5 MB');
            expect(formatSize(5242880)).to.equal('5.0 MB');
        });

        it('should handle large sizes', function () {
            expect(formatSize(10485760)).to.equal('10.0 MB');
            expect(formatSize(104857600)).to.equal('100.0 MB');
        });
    });

    describe('logDevServerBanner', function () {
        it('should log banner with all URLs', function () {
            logDevServerBanner({
                clientUrl: 'http://localhost:5173',
                serverUrl: 'http://localhost:8787',
                eventsUrl: 'https://my-app-preview.bkper.app/events',
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('Bkper App');
            expect(allOutput).to.include('http://localhost:5173');
            expect(allOutput).to.include('http://localhost:8787');
            expect(allOutput).to.include('https://my-app-preview.bkper.app/events');
        });

        it('should handle missing clientUrl', function () {
            logDevServerBanner({
                serverUrl: 'http://localhost:8787',
                eventsUrl: 'https://my-app-preview.bkper.app/events',
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('http://localhost:8787');
            expect(allOutput).to.include('https://my-app-preview.bkper.app/events');
        });

        it('should handle missing serverUrl', function () {
            logDevServerBanner({
                clientUrl: 'http://localhost:5173',
                eventsUrl: 'https://my-app-preview.bkper.app/events',
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('http://localhost:5173');
            expect(allOutput).to.include('https://my-app-preview.bkper.app/events');
        });

        it('should handle missing eventsUrl', function () {
            logDevServerBanner({
                clientUrl: 'http://localhost:5173',
                serverUrl: 'http://localhost:8787',
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('http://localhost:5173');
            expect(allOutput).to.include('http://localhost:8787');
        });

        it('should handle empty options', function () {
            logDevServerBanner({});

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('Bkper App');
        });
    });

    describe('logBuildResults', function () {
        it('should log all build results with sizes', function () {
            logBuildResults({
                webClient: { path: 'dist/web/client/', size: 148480 },
                webServer: { path: 'dist/web/server/', size: 23552 },
                events: { path: 'dist/events/', size: 18432 },
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('dist/web/client/');
            expect(allOutput).to.include('dist/web/server/');
            expect(allOutput).to.include('dist/events/');
        });

        it('should handle partial results - only webClient', function () {
            logBuildResults({
                webClient: { path: 'dist/web/client/', size: 148480 },
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('dist/web/client/');
        });

        it('should handle partial results - only webServer', function () {
            logBuildResults({
                webServer: { path: 'dist/web/server/', size: 23552 },
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('dist/web/server/');
        });

        it('should handle partial results - only events', function () {
            logBuildResults({
                events: { path: 'dist/events/', size: 18432 },
            });

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('dist/events/');
        });

        it('should handle empty results', function () {
            logBuildResults({});

            expect(consoleLogStub.called).to.be.true;

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('Build');
        });

        it('should format file sizes correctly', function () {
            logBuildResults({
                webClient: { path: 'dist/web/client/', size: 148480 },
            });

            const allOutput = consoleLogStub
                .getCalls()
                .map(call => call.args[0])
                .join('\n');
            expect(allOutput).to.include('145.0 KB');
        });
    });
});
