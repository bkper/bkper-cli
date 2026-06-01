import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { OAuth2Client } from 'google-auth-library';

interface AuthServiceModule {
    logout(): Promise<void>;
    getOAuthToken(): Promise<string>;
}

interface FetchResponse {
    status: number;
    body: Record<string, unknown>;
}

interface FetchCall {
    url: string;
    body: string;
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

    function stubFetchResponses(responses: FetchResponse[]): FetchCall[] {
        const calls: FetchCall[] = [];

        sinon.stub(globalThis, 'fetch').callsFake(async (input, init) => {
            const response = responses.shift();
            if (!response) {
                throw new Error('Unexpected fetch call');
            }

            calls.push({
                url: String(input),
                body: init?.body?.toString() ?? '',
            });

            return new Response(JSON.stringify(response.body), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        });

        return calls;
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
        expect(consoleLogStub.getCalls().some(call => String(call.args[0]).match(/revoked/i))).to.be
            .true;
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

    it('should authenticate with the OAuth device code flow', async function () {
        const calls = stubFetchResponses([
            {
                status: 200,
                body: {
                    device_code: 'device-code-123',
                    user_code: 'USER-CODE',
                    verification_url: 'https://www.google.com/device',
                    expires_in: 1800,
                    interval: 0,
                },
            },
            {
                status: 428,
                body: {
                    error: 'authorization_pending',
                },
            },
            {
                status: 200,
                body: {
                    access_token: 'device-access-token',
                    refresh_token: 'device-refresh-token',
                    expires_in: 3600,
                    scope: 'https://www.googleapis.com/auth/userinfo.email',
                    token_type: 'Bearer',
                },
            },
        ]);
        const consoleLogStub = sinon.stub(console, 'log');

        const authService = await importAuthService();
        const beforeAuth = Date.now();
        const token = await authService.getOAuthToken();
        const afterAuth = Date.now();

        expect(token).to.equal('device-access-token');
        expect(calls).to.have.length(3);
        expect(calls[0].url).to.equal('https://oauth2.googleapis.com/device/code');
        expect(calls[0].body).to.include(
            'client_id=927657669669-3c5hmibuv6gve8135u2lrorrmj2rd6vd.apps.googleusercontent.com'
        );
        expect(calls[0].body).to.include(
            'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email'
        );
        expect(calls[1].url).to.equal('https://oauth2.googleapis.com/token');
        expect(calls[1].body).to.include('device_code=device-code-123');
        expect(calls[1].body).to.include(
            'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code'
        );
        expect(consoleLogStub.getCalls().some(call => String(call.args[0]).includes('USER-CODE'))).to
            .be.true;
        expect(
            consoleLogStub
                .getCalls()
                .some(call => String(call.args[0]).includes('https://www.google.com/device'))
        ).to.be.true;

        const storedCredentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as Record<
            string,
            unknown
        >;
        expect(storedCredentials.access_token).to.equal('device-access-token');
        expect(storedCredentials.refresh_token).to.equal('device-refresh-token');
        expect(storedCredentials.expiry_date).to.be.at.least(beforeAuth + 3600000);
        expect(storedCredentials.expiry_date).to.be.at.most(afterAuth + 3600000);
    });

    it('should fail device authorization when access is denied', async function () {
        stubFetchResponses([
            {
                status: 200,
                body: {
                    device_code: 'device-code-123',
                    user_code: 'USER-CODE',
                    verification_url: 'https://www.google.com/device',
                    expires_in: 1800,
                    interval: 0,
                },
            },
            {
                status: 403,
                body: {
                    error: 'access_denied',
                },
            },
        ]);
        sinon.stub(console, 'log');

        const authService = await importAuthService();

        try {
            await authService.getOAuthToken();
            expect.fail('Expected getOAuthToken to reject');
        } catch (err) {
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/denied/i);
        }
        expect(fs.existsSync(credentialsPath)).to.be.false;
    });
});
