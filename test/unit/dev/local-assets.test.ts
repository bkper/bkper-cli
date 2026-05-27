import { expect, setupTestEnvironment } from '../helpers/test-setup.js';

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
});
