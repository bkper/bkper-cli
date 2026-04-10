import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { OAuth2Client } from 'google-auth-library';

interface AuthServiceModule {
    logout(): Promise<void>;
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
});
