import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import type { TunnelHandle, CloudflaredTunnelOptions } from '../../../src/dev/tunnel.js';
import { startsEventsTunnel } from '../../../src/dev/tunnel.js';
import type { Logger } from '../../../src/dev/logger.js';

describe('cloudflared tunnel', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    describe('TunnelHandle interface', function () {
        it('should define the expected shape', function () {
            // Type-level test: verify the interface exists and has expected properties
            const mockHandle: TunnelHandle = {
                url: 'https://example.trycloudflare.com',
                stop: async () => {},
            };

            expect(mockHandle.url).to.be.a('string');
            expect(mockHandle.stop).to.be.a('function');
        });
    });

    describe('CloudflaredTunnelOptions interface', function () {
        it('should accept port and optional logger', function () {
            const options: CloudflaredTunnelOptions = {
                port: 8080,
            };

            expect(options.port).to.equal(8080);
            expect(options.logger).to.be.undefined;
        });
    });

    describe('startsEventsTunnel', function () {
        function recordingLogger(lines: string[]): Logger {
            const record = (message: string) => lines.push(message);
            return { info: record, success: record, warn: record, error: record, debug: record };
        }

        it('starts it for an App with events, outside the managed sandbox, silently', function () {
            const lines: string[] = [];

            expect(startsEventsTunnel(true, recordingLogger(lines), false)).to.be.true;
            expect(startsEventsTunnel(false, recordingLogger(lines), false)).to.be.false;
            expect(lines).to.deep.equal([]);
        });

        it('skips it in the managed sandbox and says why, once', function () {
            const lines: string[] = [];

            expect(startsEventsTunnel(true, recordingLogger(lines), true)).to.be.false;
            expect(lines).to.have.length(1);
            expect(lines[0]).to.include('managed sandbox');
            expect(lines[0]).to.include('bkper app deploy --preview');
        });

        it('says nothing in the managed sandbox for an App without events', function () {
            const lines: string[] = [];

            expect(startsEventsTunnel(false, recordingLogger(lines), true)).to.be.false;
            expect(lines).to.deep.equal([]);
        });
    });
});
