import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import sinon from 'sinon';

describe('CLI - auth token Command', function () {
    let getStoredOAuthTokenStub: sinon.SinonStub;
    let stdoutWriteStub: sinon.SinonStub;
    let stderrWriteStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;

    beforeEach(function () {
        setupTestEnvironment();

        getStoredOAuthTokenStub = sinon.stub();
        stdoutWriteStub = sinon.stub(process.stdout, 'write');
        stderrWriteStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should print the access token to stdout when available', async function () {
        getStoredOAuthTokenStub.resolves('ya29.test-access-token-12345');

        const accessToken = await getStoredOAuthTokenStub();
        if (!accessToken) {
            console.error('Error: Authentication required. Run: bkper auth login');
            process.exit(1);
        }
        process.stdout.write(accessToken);

        expect(stdoutWriteStub.calledOnce).to.be.true;
        expect(stdoutWriteStub.calledWith('ya29.test-access-token-12345')).to.be.true;
        expect(stderrWriteStub.called).to.be.false;
        expect(processExitStub.called).to.be.false;
    });

    it('should print error to stderr and exit 1 when no current token is available', async function () {
        getStoredOAuthTokenStub.resolves(undefined);

        const accessToken = await getStoredOAuthTokenStub();
        if (!accessToken) {
            console.error('Error: Authentication required. Run: bkper auth login');
            process.exit(1);
        }

        expect(stderrWriteStub.calledOnce).to.be.true;
        expect(
            stderrWriteStub.calledWith('Error: Authentication required. Run: bkper auth login')
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
        expect(stdoutWriteStub.called).to.be.false;
    });

    it('should output raw token without trailing newline when piped (non-TTY)', async function () {
        getStoredOAuthTokenStub.resolves('ya29.raw-token');

        const originalIsTTY = process.stdout.isTTY;
        Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true });

        const accessToken = await getStoredOAuthTokenStub();
        if (!accessToken) {
            console.error('Error: Authentication required. Run: bkper auth login');
            process.exit(1);
        }
        if (process.stdout.isTTY) {
            console.log(accessToken);
        } else {
            process.stdout.write(accessToken);
        }

        const output = stdoutWriteStub.firstCall.args[0];
        expect(output).to.equal('ya29.raw-token');
        expect(output).to.not.include('\n');

        Object.defineProperty(process.stdout, 'isTTY', {
            value: originalIsTTY,
            configurable: true,
        });
    });

    it('should output token with trailing newline when interactive (TTY)', async function () {
        getStoredOAuthTokenStub.resolves('ya29.tty-token');

        const consoleLogStub = sinon.stub(console, 'log');
        const originalIsTTY = process.stdout.isTTY;
        Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

        const accessToken = await getStoredOAuthTokenStub();
        if (!accessToken) {
            console.error('Error: Authentication required. Run: bkper auth login');
            process.exit(1);
        }
        if (process.stdout.isTTY) {
            console.log(accessToken);
        } else {
            process.stdout.write(accessToken);
        }

        expect(consoleLogStub.calledOnce).to.be.true;
        expect(consoleLogStub.calledWith('ya29.tty-token')).to.be.true;
        expect(stdoutWriteStub.called).to.be.false;

        consoleLogStub.restore();
        Object.defineProperty(process.stdout, 'isTTY', {
            value: originalIsTTY,
            configurable: true,
        });
    });
});
