import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import sinon from 'sinon';
import { statusApp } from '../../../../src/commands/apps/deploy.js';

describe('CLI - apps status Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
        sinon.stub(console, 'log');
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should request status for an explicit app id without loading local config', async function () {
        const getStub = sinon.stub().resolves({
            data: { appId: 'punta-padel', prod: null, preview: null },
            error: undefined,
        });
        const loadAppConfigStub = sinon.stub().throws(new Error('should not load local config'));

        await statusApp('punta-padel', {
            loadAppConfig: loadAppConfigStub,
            getStoredOAuthToken: async () => 'token-123',
            createPlatformClient: () => ({ GET: getStub }),
            handleError: error => {
                throw new Error(String(error));
            },
            exit(code: number): never {
                throw new Error(`process.exit(${code})`);
            },
        });

        expect(loadAppConfigStub.called).to.equal(false);
        expect(getStub.calledOnce).to.equal(true);
        expect(getStub.firstCall.args).to.deep.equal([
            '/api/apps/{appId}',
            { params: { path: { appId: 'punta-padel' } } },
        ]);
    });

    it('should fall back to the app id from local config', async function () {
        const getStub = sinon.stub().resolves({
            data: { appId: 'local-app', prod: null, preview: null },
            error: undefined,
        });
        const loadAppConfigStub = sinon.stub().returns({ id: 'local-app' });

        await statusApp(undefined, {
            loadAppConfig: loadAppConfigStub,
            getStoredOAuthToken: async () => 'token-123',
            createPlatformClient: () => ({ GET: getStub }),
            handleError: error => {
                throw new Error(String(error));
            },
            exit(code: number): never {
                throw new Error(`process.exit(${code})`);
            },
        });

        expect(loadAppConfigStub.calledOnce).to.equal(true);
        expect(getStub.firstCall.args[1]).to.deep.equal({
            params: { path: { appId: 'local-app' } },
        });
    });
});
