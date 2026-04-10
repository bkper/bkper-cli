import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { createPlatformClient } from '../../../src/platform/client.js';

function getCapturedHeaders(fetchStub: sinon.SinonStub): Headers {
    const request = fetchStub.firstCall.args[0];
    if (request instanceof Request) {
        return request.headers;
    }

    const requestInit = fetchStub.firstCall.args[1];
    return new Headers(
        requestInit && typeof requestInit === 'object' && 'headers' in requestInit
            ? (requestInit as RequestInit).headers
            : undefined
    );
}

describe('platform/client', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should omit the Authorization header when no token is provided', async function () {
        const fetchStub = sinon
            .stub(globalThis, 'fetch')
            .resolves(new Response(JSON.stringify({ success: false }), { status: 401 }));

        const client = createPlatformClient(undefined, 'https://platform.example.com');
        await client.GET('/api/apps/{appId}', {
            params: {
                path: { appId: 'test-app' },
            },
        });

        const headers = getCapturedHeaders(fetchStub);

        expect(headers.has('Authorization')).to.be.false;
    });

    it('should include the Authorization header when a token is provided', async function () {
        const fetchStub = sinon
            .stub(globalThis, 'fetch')
            .resolves(new Response(JSON.stringify({ success: false }), { status: 401 }));

        const client = createPlatformClient('token-123', 'https://platform.example.com');
        await client.GET('/api/apps/{appId}', {
            params: {
                path: { appId: 'test-app' },
            },
        });

        const headers = getCapturedHeaders(fetchStub);

        expect(headers.get('Authorization')).to.equal('Bearer token-123');
    });
});
