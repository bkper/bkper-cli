import { expect, setupTestEnvironment } from '../helpers/test-setup.js';

function throwFetchFailed(code: string): never {
    const error = new TypeError('fetch failed');
    Object.defineProperty(error, 'cause', { value: { code } });
    throw error;
}

describe('local-assets', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('forwards asset requests to the configured Vite dev server', async function () {
        const forwardedRequests: Request[] = [];
        const { createLocalAssetsService } = await import('../../../src/dev/local-assets.js');
        const service = createLocalAssetsService({
            host: '127.0.0.1',
            port: 5174,
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return new Response('from vite', { status: 203 });
            },
        });

        const response = await service(
            new Request('http://localhost:8787/src/index.ts?import', {
                headers: {
                    host: 'localhost:8787',
                    'x-test': 'visible',
                },
            })
        );

        expect(response.status).to.equal(203);
        expect(await response.text()).to.equal('from vite');
        expect(forwardedRequests).to.have.length(1);
        expect(forwardedRequests[0].url).to.equal('http://127.0.0.1:5174/src/index.ts?import');
        expect(forwardedRequests[0].headers.get('host')).to.equal(null);
        expect(forwardedRequests[0].headers.get('x-test')).to.equal('visible');
    });

    it('falls back across loopback addresses when default localhost cannot connect', async function () {
        const forwardedUrls: string[] = [];
        const { createLocalAssetsService } = await import('../../../src/dev/local-assets.js');
        const service = createLocalAssetsService({
            port: 5173,
            forwardFetch: async request => {
                forwardedUrls.push(request.url);
                if (forwardedUrls.length < 3) {
                    throwFetchFailed('ECONNREFUSED');
                }
                return new Response('from ipv6 vite');
            },
        });

        const response = await service(new Request('http://localhost:8787/'));

        expect(response.status).to.equal(200);
        expect(await response.text()).to.equal('from ipv6 vite');
        expect(forwardedUrls).to.deep.equal([
            'http://localhost:5173/',
            'http://127.0.0.1:5173/',
            'http://[::1]:5173/',
        ]);
    });
});
