import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import type { TunnelHandle, CloudflaredTunnelOptions } from '../../../src/dev/tunnel.js';

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
});
