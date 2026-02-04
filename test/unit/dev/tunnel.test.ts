import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { extractCloudflaredUrl } from '../../../src/dev/tunnel.js';

describe('cloudflared tunnel parsing', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should extract the tunnel URL from output', function () {
        const output =
            '2026-02-04T12:00:00Z INF Starting tunnel\n' +
            '2026-02-04T12:00:01Z INF Assigned URL https://sample-quiet-rain.trycloudflare.com\n';

        const url = extractCloudflaredUrl(output);

        expect(url).to.equal('https://sample-quiet-rain.trycloudflare.com');
    });

    it('should return undefined when no URL is present', function () {
        const output = '2026-02-04T12:00:00Z INF Starting tunnel\n';

        const url = extractCloudflaredUrl(output);

        expect(url).to.equal(undefined);
    });
});
