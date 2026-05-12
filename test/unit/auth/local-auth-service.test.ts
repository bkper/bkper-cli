import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { OAuth2Client } from 'google-auth-library';

interface FakeServer {
    on(event: string, handler: Function): void;
    listen(port: number, callback: Function): void;
    close(): void;
    closeAllConnections(): void;
    address(): { port: number } | null;
    _triggerError(err: Error): void;
    _triggerListen(): void;
    _triggerRequest(req: unknown, res: unknown): void;
    _setRequestHandler(handler: Function): void;
}

interface AuthServiceModule {
    logout(): Promise<void>;
    getOAuthToken(): Promise<string>;
}

describe('auth/local-auth-service', function () {
    const originalHome = process.env.HOME;
    let tempHome: string;
    let credentialsPath: string;

    async function importAuthService(): Promise<AuthServiceModule> {
        const moduleUrl = new URL(
            `../../../src/auth/local-auth-service.js?test=${Date.now()}-${Math.random()}`,
            import.meta.url
        );
        return await import(moduleUrl.href);
    }

    function createFakeServer(options: { shouldFail?: boolean; failCode?: string } = {}): FakeServer {
        let requestHandler: Function;
        let errorHandler: Function;
        let listenCallback: Function;
        let assignedPort = 0;

        return {
            on(event: string, handler: Function) {
                if (event === 'error') {
                    errorHandler = handler;
                }
            },
            listen(port: number, callback: Function) {
                assignedPort = port;
                listenCallback = callback;
                if (options.shouldFail) {
                    setImmediate(() => {
                        const err = new Error('Permission denied');
                        (err as Error & { code: string }).code = options.failCode ?? 'EACCES';
                        if (errorHandler) {
                            errorHandler(err);
                        }
                    });
                } else {
                    setImmediate(() => {
                        if (listenCallback) {
                            listenCallback();
                        }
                        setImmediate(() => {
                            if (requestHandler) {
                                requestHandler(
                                    { url: '/oauth2callback?code=fake-code' },
                                    { writeHead: () => {}, end: () => {} }
                                );
                            }
                        });
                    });
                }
            },
            close() {},
            closeAllConnections() {},
            address() {
                return { port: assignedPort === 0 ? 54321 : assignedPort };
            },
            _triggerError(err: Error) {
                if (errorHandler) {
                    errorHandler(err);
                }
            },
            _triggerListen() {
                if (listenCallback) {
                    listenCallback();
                }
            },
            _triggerRequest(req: unknown, res: unknown) {
                if (requestHandler) {
                    requestHandler(req, res);
                }
            },
            _setRequestHandler(handler: Function) {
                requestHandler = handler;
            },
        };
    }

    beforeEach(function () {
        setupTestEnvironment();
        tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-auth-test-'));
        process.env.HOME = tempHome;
        credentialsPath = path.join(tempHome, '.config', 'bkper', '.bkper-credentials.json');
        fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
    });

    afterEach(function () {
        sinon.restore();
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
        if (fs.existsSync(tempHome)) {
            fs.rmSync(tempHome, { recursive: true, force: true });
        }
    });

    it('should revoke the stored refresh token and clear local credentials on logout', async function () {
        fs.writeFileSync(
            credentialsPath,
            JSON.stringify({
                refresh_token: 'refresh-token-123',
                access_token: 'access-token-123',
            }),
            'utf8'
        );

        const revokeTokenStub = sinon.stub(OAuth2Client.prototype, 'revokeToken');
        const consoleLogStub = sinon.stub(console, 'log');

        const authService = await importAuthService();
        await authService.logout();

        expect(revokeTokenStub.calledOnce).to.be.true;
        expect(revokeTokenStub.firstCall.args[0]).to.equal('refresh-token-123');
        expect(fs.existsSync(credentialsPath)).to.be.false;
        expect(String(consoleLogStub.firstCall.args[0])).to.match(/revoked/i);
    });

    it('should clear local credentials even when remote revocation fails', async function () {
        fs.writeFileSync(
            credentialsPath,
            JSON.stringify({
                refresh_token: 'refresh-token-123',
            }),
            'utf8'
        );

        sinon.stub(OAuth2Client.prototype, 'revokeToken').throws(new Error('network failure'));
        const consoleWarnStub = sinon.stub(console, 'warn');

        const authService = await importAuthService();
        await authService.logout();

        expect(fs.existsSync(credentialsPath)).to.be.false;
        expect(String(consoleWarnStub.firstCall.args[0])).to.match(/revocation failed/i);
    });

    it('should try the next port when the default port is in use', async function () {
        let serverCount = 0;

        sinon.stub(http, 'createServer').callsFake(((handler: Function) => {
            serverCount++;
            const fakeServer = createFakeServer({
                shouldFail: serverCount === 1,
                failCode: 'EADDRINUSE',
            });
            fakeServer._setRequestHandler(handler);
            return fakeServer as unknown as http.Server;
        }) as unknown as typeof http.createServer);

        sinon.stub(OAuth2Client.prototype, 'getToken').resolves({
            tokens: { access_token: 'new-access-token' },
        });
        sinon.stub(OAuth2Client.prototype, 'setCredentials');
        sinon.stub(OAuth2Client.prototype, 'getAccessToken').resolves({
            token: 'new-access-token',
        });
        sinon.stub(console, 'log');

        const authService = await importAuthService();
        const token = await authService.getOAuthToken();

        expect(serverCount).to.equal(2);
        expect(token).to.equal('new-access-token');
    });

    it('should reject when all ports in range are in use', async function () {
        sinon.stub(http, 'createServer').callsFake(((handler: Function) => {
            const fakeServer = createFakeServer({
                shouldFail: true,
                failCode: 'EADDRINUSE',
            });
            fakeServer._setRequestHandler(handler);
            return fakeServer as unknown as http.Server;
        }) as unknown as typeof http.createServer);

        sinon.stub(console, 'log');

        const authService = await importAuthService();

        try {
            await authService.getOAuthToken();
            expect.fail('Expected getOAuthToken to reject');
        } catch (err) {
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/All ports in range 3000-3009 are in use/);
        }
    });

    it('should reject immediately on non-EADDRINUSE errors', async function () {
        sinon.stub(http, 'createServer').callsFake(((handler: Function) => {
            const fakeServer = createFakeServer({
                shouldFail: true,
                failCode: 'EACCES',
            });
            fakeServer._setRequestHandler(handler);
            return fakeServer as unknown as http.Server;
        }) as unknown as typeof http.createServer);

        sinon.stub(console, 'log');

        const authService = await importAuthService();

        try {
            await authService.getOAuthToken();
            expect.fail('Expected getOAuthToken to reject');
        } catch (err) {
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/Failed to start local server: Permission denied/);
        }
    });
});
