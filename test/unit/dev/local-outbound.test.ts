import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { createLocalOutboundService } from '../../../src/dev/local-outbound.js';

describe('local-outbound', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    function createJsonResponse(status: number, body: unknown): Response {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
        });
    }

    it('passes through non-Bkper API requests without reading local auth', async function () {
        let tokenRead = false;
        const forwardedRequests: Request[] = [];
        const originalRequest = new Request('https://example.com/data', {
            headers: { Authorization: 'Bearer caller-token' },
        });
        const service = createLocalOutboundService({
            appId: 'my-app',
            getAccessToken: async () => {
                tokenRead = true;
                return 'local-token';
            },
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return new Response('ok');
            },
        });

        const response = await service(originalRequest);

        expect(response.status).to.equal(200);
        expect(tokenRead).to.be.false;
        expect(forwardedRequests[0]).to.equal(originalRequest);
    });

    it('injects local OAuth and agent headers for exact Bkper API requests', async function () {
        const forwardedRequests: Request[] = [];
        const service = createLocalOutboundService({
            appId: 'my-app',
            getAccessToken: async () => 'local-token',
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return createJsonResponse(200, { ok: true });
            },
        });

        const response = await service(
            new Request('https://api.bkper.app/v5/books', {
                headers: {
                    Authorization: 'Bearer app-token',
                    'bkper-agent-id': 'spoofed-agent',
                    Cookie: 'bkper_session=secret; app_cookie=1; bkper_session_dev=dev',
                },
            })
        );

        expect(response.status).to.equal(200);
        expect(forwardedRequests).to.have.length(1);
        expect(forwardedRequests[0].headers.get('Authorization')).to.equal('Bearer local-token');
        expect(forwardedRequests[0].headers.get('bkper-agent-id')).to.equal('my-app');
        expect(forwardedRequests[0].headers.get('Cookie')).to.equal('app_cookie=1');
    });

    it('rebuilds forwarded Bkper API requests from primitive fields', async function () {
        const forwardedRequests: Request[] = [];
        const service = createLocalOutboundService({
            appId: 'my-app',
            getAccessToken: async () => 'local-token',
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return createJsonResponse(200, { ok: true });
            },
        });

        const response = await service(
            new Request('https://api.bkper.app/v5/transactions', {
                method: 'POST',
                body: JSON.stringify({ amount: '10' }),
                headers: { 'content-type': 'application/json' },
            })
        );

        expect(response.status).to.equal(200);
        expect(forwardedRequests).to.have.length(1);
        expect(forwardedRequests[0].url).to.equal('https://api.bkper.app/v5/transactions');
        expect(forwardedRequests[0].method).to.equal('POST');
        expect(forwardedRequests[0].headers.get('Authorization')).to.equal('Bearer local-token');
        expect(await forwardedRequests[0].text()).to.equal('{"amount":"10"}');
    });

    it('returns a clear local 401 when CLI auth is missing', async function () {
        const forwardedRequests: Request[] = [];
        const service = createLocalOutboundService({
            appId: 'my-app',
            getAccessToken: async () => undefined,
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return new Response('should not be called');
            },
        });

        const response = await service(new Request('https://api.bkper.app/v5/books'));
        const body = await response.json();

        expect(response.status).to.equal(401);
        expect(body).to.deep.equal({ error: 'Authentication required. Run: bkper auth login' });
        expect(forwardedRequests).to.deep.equal([]);
    });

    it('does not inject tokens into non-HTTPS or non-exact API hosts', async function () {
        let tokenReads = 0;
        const forwardedRequests: Request[] = [];
        const service = createLocalOutboundService({
            appId: 'my-app',
            getAccessToken: async () => {
                tokenReads++;
                return 'local-token';
            },
            forwardFetch: async request => {
                forwardedRequests.push(request);
                return new Response('ok');
            },
        });

        await service(new Request('http://api.bkper.app/v5/books'));
        await service(new Request('https://evil.api.bkper.app/v5/books'));

        expect(tokenReads).to.equal(0);
        expect(forwardedRequests).to.have.length(2);
        expect(forwardedRequests[0].url).to.equal('http://api.bkper.app/v5/books');
        expect(forwardedRequests[1].url).to.equal('https://evil.api.bkper.app/v5/books');
    });
});
