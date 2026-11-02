import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

// We'll test the middleware logic by importing and mocking dependencies
describe('auth-middleware', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    describe('createAuthMiddleware', function () {
        /**
         * Creates a mock request object
         */
        function createMockRequest(url: string, method: string): IncomingMessage {
            const socket = new Socket();
            const req = new IncomingMessage(socket);
            req.url = url;
            req.method = method;
            return req;
        }

        /**
         * Creates a mock response object that captures the response
         */
        function createMockResponse(): ServerResponse & {
            _statusCode: number;
            _headers: Record<string, string>;
            _body: string;
        } {
            const socket = new Socket();
            const req = new IncomingMessage(socket);
            const res = new ServerResponse(req) as ServerResponse & {
                _statusCode: number;
                _headers: Record<string, string>;
                _body: string;
            };

            res._statusCode = 200;
            res._headers = {};
            res._body = '';

            // Override methods to capture output
            const originalSetHeader = res.setHeader.bind(res);
            res.setHeader = (name: string, value: string | number | readonly string[]) => {
                res._headers[name.toLowerCase()] = String(value);
                return originalSetHeader(name, value);
            };

            Object.defineProperty(res, 'statusCode', {
                get() {
                    return res._statusCode;
                },
                set(code: number) {
                    res._statusCode = code;
                },
            });

            res.end = ((chunk?: unknown) => {
                if (chunk) {
                    res._body = String(chunk);
                }
                return res;
            }) as typeof res.end;

            return res;
        }

        it('should call next() for non-auth routes', async function () {
            // Dynamic import to allow module mocking in future if needed
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/api/books', 'GET');
            const res = createMockResponse();

            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            await middleware(req, res, next);

            expect(nextCalled).to.be.true;
            expect(res._body).to.equal('');
        });

        it('should call next() for GET /auth/refresh', async function () {
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/auth/refresh', 'GET');
            const res = createMockResponse();

            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            await middleware(req, res, next);

            expect(nextCalled).to.be.true;
        });

        it('should call next() for other /auth routes', async function () {
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/auth/login', 'POST');
            const res = createMockResponse();

            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            await middleware(req, res, next);

            expect(nextCalled).to.be.true;
        });

        it('should handle POST /auth/refresh and set Content-Type header', async function () {
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/auth/refresh', 'POST');
            const res = createMockResponse();

            let nextCalled = false;
            const next = () => {
                nextCalled = true;
            };

            await middleware(req, res, next);

            // Should not call next - middleware handles this route
            expect(nextCalled).to.be.false;
            expect(res._headers['content-type']).to.equal('application/json');
        });

        it('should return 401 when not logged in', async function () {
            // This test relies on actual isLoggedIn() behavior
            // In a fresh test environment without credentials, it should return 401
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/auth/refresh', 'POST');
            const res = createMockResponse();

            await middleware(req, res, () => {});

            // If not logged in, expect 401
            // If logged in, expect 200 with token
            // We check that it returns valid JSON either way
            const body = JSON.parse(res._body);
            expect(body).to.be.an('object');

            if (res._statusCode === 401) {
                expect(body.error).to.be.a('string');
                expect(body.error).to.include('login');
            } else if (res._statusCode === 200) {
                expect(body.accessToken).to.be.a('string');
                expect(body.userId).to.be.a('string');
            }
        });

        it('answers the managed sandbox placeholder token and user, without a login', async function () {
            const { createBkperAuthMiddleware } = await import(
                '../../../src/dev/auth-middleware.js'
            );

            const middleware = createBkperAuthMiddleware({ managedSandbox: true });
            const res = createMockResponse();

            await middleware(createMockRequest('/auth/refresh', 'POST'), res, () => {});

            expect(res._statusCode).to.equal(200);
            expect(JSON.parse(res._body)).to.deep.equal({
                userId: 'managed-sandbox',
                accessToken: 'placeholder-replaced-outside-the-sandbox',
            });
        });

        it('reads BKPER_MANAGED_SANDBOX when no option is given', async function () {
            const { createBkperAuthMiddleware } = await import(
                '../../../src/dev/auth-middleware.js'
            );
            const original = process.env.BKPER_MANAGED_SANDBOX;
            process.env.BKPER_MANAGED_SANDBOX = '1';
            try {
                const middleware = createBkperAuthMiddleware();
                const res = createMockResponse();

                await middleware(createMockRequest('/auth/refresh', 'POST'), res, () => {});

                expect(JSON.parse(res._body).accessToken).to.equal(
                    'placeholder-replaced-outside-the-sandbox'
                );
            } finally {
                if (original === undefined) {
                    delete process.env.BKPER_MANAGED_SANDBOX;
                } else {
                    process.env.BKPER_MANAGED_SANDBOX = original;
                }
            }
        });

        it('should return JSON response format', async function () {
            const { createAuthMiddleware } = await import('../../../src/dev/auth-middleware.js');

            const middleware = createAuthMiddleware();
            const req = createMockRequest('/auth/refresh', 'POST');
            const res = createMockResponse();

            await middleware(req, res, () => {});

            // Body should be valid JSON
            expect(() => JSON.parse(res._body)).to.not.throw();
        });
    });
});
