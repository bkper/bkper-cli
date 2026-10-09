import { expect } from '../../helpers/test-setup.js';
import type { AppApiDependencies } from '../../../../src/commands/apps/api.js';

const { formatAppResponse, getAppApiSpec, requestAppApi } = await import(
    '../../../../src/commands/apps/api.js'
);

interface Call {
    url: string;
    init: RequestInit;
}

function stubFetch(
    respond: () => Response,
    token?: string
): { calls: Call[]; dependencies: AppApiDependencies } {
    const calls: Call[] = [];
    return {
        calls,
        dependencies: {
            fetch: async (url, init) => {
                calls.push({ url, init });
                return respond();
            },
            getStoredOAuthToken: async () => token,
        },
    };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function headersOf(call: Call): Headers {
    return new Headers(call.init.headers);
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (error) {
        return error as Error;
    }
    throw new Error('Expected the promise to reject');
}

const SPEC = { openapi: '3.0.0', info: { title: 'Inventory Bot API' }, paths: {} };

describe('CLI - app api', function () {
    describe('spec', function () {
        it("returns the app's OpenAPI spec from its production host", async function () {
            const { calls, dependencies } = stubFetch(() => json(SPEC), 'stored-token');

            const spec = await getAppApiSpec('inventory-bot', {}, dependencies);

            expect(spec).to.deep.equal(SPEC);
            expect(calls.map(call => call.url)).to.deep.equal([
                'https://inventory-bot.bkper.app/openapi.json',
            ]);
            // The spec is public: no credentials are sent for it.
            expect(headersOf(calls[0]).has('authorization')).to.equal(false);
        });

        it('reads the preview host with the preview option', async function () {
            const { calls, dependencies } = stubFetch(() => json(SPEC));

            await getAppApiSpec('inventory-bot', { preview: true }, dependencies);

            expect(calls[0].url).to.equal('https://inventory-bot-preview.bkper.app/openapi.json');
        });

        it('reports apps that answer with a web page instead of a spec', async function () {
            const { dependencies } = stubFetch(
                () =>
                    new Response('<!doctype html><html></html>', {
                        status: 200,
                        headers: { 'content-type': 'text/html' },
                    })
            );

            const error = await rejection(getAppApiSpec('bkper-csv-app', {}, dependencies));

            expect(error.message).to.equal('bkper-csv-app does not publish an OpenAPI spec');
        });

        it('reports apps without a spec route', async function () {
            const { dependencies } = stubFetch(() => new Response('Not found', { status: 404 }));

            const error = await rejection(getAppApiSpec('subledger-bot', {}, dependencies));

            expect(error.message).to.equal('subledger-bot does not publish an OpenAPI spec');
        });

        it('rejects app IDs that are not a single host label', async function () {
            const { calls, dependencies } = stubFetch(() => json(SPEC));

            for (const appId of ['evil.example/x', 'a.b', '', '-app']) {
                const error = await rejection(getAppApiSpec(appId, {}, dependencies));
                expect(error.message).to.match(/^Invalid app ID/);
            }
            expect(calls).to.have.length(0);
        });
    });

    describe('request', function () {
        it('sends GET by default with the stored login', async function () {
            const { calls, dependencies } = stubFetch(() => json({ rates: {} }), 'stored-token');

            const body = await requestAppApi(
                'exchange-bot',
                '/api/v1/books/b1/exchange-rates?date=2026-08-05',
                {},
                dependencies
            );

            expect(body).to.equal('{"rates":{}}');
            expect(calls[0].url).to.equal(
                'https://exchange-bot.bkper.app/api/v1/books/b1/exchange-rates?date=2026-08-05'
            );
            expect(calls[0].init.method).to.equal('GET');
            expect(calls[0].init.body).to.equal(undefined);
            expect(headersOf(calls[0]).get('authorization')).to.equal('Bearer stored-token');
        });

        it('sends no credentials without a stored login', async function () {
            const { calls, dependencies } = stubFetch(() => json({}));

            await requestAppApi('exchange-bot', '/api/v1/books/b1/exchange-rates', {}, dependencies);

            expect(headersOf(calls[0]).has('authorization')).to.equal(false);
        });

        it('sends data as JSON with POST, like curl', async function () {
            const { calls, dependencies } = stubFetch(() => json({ ok: true }));
            const data = '{"quantity":1}';

            await requestAppApi(
                'inventory-bot',
                '/api/v1/books/b1/accounts/a1/calculate',
                { data },
                dependencies
            );

            expect(calls[0].init.method).to.equal('POST');
            expect(calls[0].init.body).to.equal(data);
            expect(headersOf(calls[0]).get('content-type')).to.equal('application/json');
        });

        it('uses the given method', async function () {
            const { calls, dependencies } = stubFetch(() => json({}));

            await requestAppApi(
                'inventory-bot',
                '/api/v1/books/b1/accounts/a1/reset',
                { method: 'post' },
                dependencies
            );
            await requestAppApi(
                'merge-duplicates',
                '/api/v1/learn',
                { method: 'PUT', data: '{}' },
                dependencies
            );

            expect(calls.map(call => call.init.method)).to.deep.equal(['POST', 'PUT']);
        });

        it('rejects data that is not JSON before calling the app', async function () {
            const { calls, dependencies } = stubFetch(() => json({}));

            const error = await rejection(
                requestAppApi('merge-duplicates', '/api/v1/analyze', { data: '{bad' }, dependencies)
            );

            expect(error.message).to.equal('Request data must be valid JSON');
            expect(calls).to.have.length(0);
        });

        it("only reaches the app's own /api/ routes", async function () {
            const { calls, dependencies } = stubFetch(() => json({}));
            const paths = [
                '/events',
                '/openapi.json',
                '/api',
                '/api/../events',
                '/api/%2e%2e/events',
                'api/v1/analyze',
                '//evil.example/api/v1/analyze',
                'https://evil.example/api/v1/analyze',
            ];

            for (const path of paths) {
                const error = await rejection(
                    requestAppApi('merge-duplicates', path, {}, dependencies)
                );
                expect(error.message, path).to.match(/^App API paths must start with \/api\//);
            }
            expect(calls).to.have.length(0);
        });

        it('does not follow redirects', async function () {
            const { calls, dependencies } = stubFetch(
                () => new Response(null, { status: 302, headers: { location: '/login' } })
            );

            const error = await rejection(
                requestAppApi('exchange-bot', '/api/v1/books/b1/exchange-rates', {}, dependencies)
            );

            expect(calls[0].init.redirect).to.equal('manual');
            expect(error.message).to.equal('302 Redirect to /login not followed');
        });

        it("reports the app's error message with the status", async function () {
            const { dependencies } = stubFetch(() =>
                json({ error: { message: 'Route not found: GET /api/v1/missing' } }, 404)
            );

            const error = await rejection(
                requestAppApi('exchange-bot', '/api/v1/missing', {}, dependencies)
            );

            expect(error.message).to.equal('404 Route not found: GET /api/v1/missing');
        });

        it('reports a short text body when the error is not JSON', async function () {
            const { dependencies } = stubFetch(
                () => new Response('Upstream unavailable', { status: 502 })
            );

            const error = await rejection(
                requestAppApi('exchange-bot', '/api/v1/missing', {}, dependencies)
            );

            expect(error.message).to.equal('502 Upstream unavailable');
        });
    });

    describe('response output', function () {
        it('prints JSON compact, or pretty for a person', function () {
            expect(formatAppResponse('{"a": [1, 2]}', false)).to.equal('{"a":[1,2]}');
            expect(formatAppResponse('{"a":1}', true)).to.equal('{\n  "a": 1\n}');
        });

        it('prints other bodies as they are and nothing for an empty body', function () {
            expect(formatAppResponse('id,amount\n1,10', false)).to.equal('id,amount\n1,10');
            expect(formatAppResponse('', false)).to.equal(undefined);
        });
    });
});
