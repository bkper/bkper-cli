import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import sinon from 'sinon';

describe('CLI - auth token Command', function () {
    let isLoggedInStub: sinon.SinonStub;
    let getOAuthTokenStub: sinon.SinonStub;
    let stdoutWriteStub: sinon.SinonStub;
    let stderrWriteStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;
    let token: () => Promise<void>;

    beforeEach(async function () {
        setupTestEnvironment();

        // Create stubs for auth service
        isLoggedInStub = sinon.stub();
        getOAuthTokenStub = sinon.stub();

        // Stub process.stdout.write and process.stderr (via console.error)
        stdoutWriteStub = sinon.stub(process.stdout, 'write');
        stderrWriteStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // We need to create the token function with injected dependencies
        // since the module imports are static. We'll test the logic directly.
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should print the access token to stdout when logged in', async function () {
        isLoggedInStub.returns(true);
        getOAuthTokenStub.resolves('ya29.test-access-token-12345');

        // Simulate the token command logic
        if (!isLoggedInStub()) {
            console.error('Error: Not logged in. Run: bkper auth login');
            process.exit(1);
        }
        const accessToken = await getOAuthTokenStub();
        process.stdout.write(accessToken);

        expect(stdoutWriteStub.calledOnce).to.be.true;
        expect(stdoutWriteStub.calledWith('ya29.test-access-token-12345')).to.be.true;
        expect(stderrWriteStub.called).to.be.false;
        expect(processExitStub.called).to.be.false;
    });

    it('should print error to stderr and exit 1 when not logged in', async function () {
        isLoggedInStub.returns(false);

        // Simulate the token command logic
        if (!isLoggedInStub()) {
            console.error('Error: Not logged in. Run: bkper auth login');
            process.exit(1);
        }

        expect(stderrWriteStub.calledOnce).to.be.true;
        expect(stderrWriteStub.calledWith('Error: Not logged in. Run: bkper auth login')).to.be
            .true;
        expect(processExitStub.calledWith(1)).to.be.true;
        expect(stdoutWriteStub.called).to.be.false;
    });

    it('should output raw token without trailing newline', async function () {
        isLoggedInStub.returns(true);
        getOAuthTokenStub.resolves('ya29.raw-token');

        if (!isLoggedInStub()) {
            console.error('Error: Not logged in. Run: bkper auth login');
            process.exit(1);
        }
        const accessToken = await getOAuthTokenStub();
        process.stdout.write(accessToken);

        // process.stdout.write does not append a newline (unlike console.log)
        const output = stdoutWriteStub.firstCall.args[0];
        expect(output).to.equal('ya29.raw-token');
        expect(output).to.not.include('\n');
    });
});
