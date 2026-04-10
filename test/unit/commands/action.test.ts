import { expect, setupTestEnvironment } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { BkperError } from 'bkper-js';
import { withAction } from '../../../src/commands/action.js';

describe('commands/action', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    afterEach(function () {
        sinon.restore();
    });

    it('should print login guidance for unauthorized API errors', async function () {
        const consoleErrorStub = sinon.stub(console, 'error');
        const exitError = new Error('process.exit(1)');
        const processExitStub = sinon.stub(process, 'exit').throws(exitError);

        const action = withAction(
            'listing books',
            async () => {
                throw new BkperError(401, 'Invalid or expired token');
            },
            { skipSetup: true }
        );

        try {
            await action();
            expect.fail('Expected action to exit');
        } catch (err) {
            expect(err).to.equal(exitError);
        }

        expect(
            consoleErrorStub.calledWith(
                'Error listing books: Authentication required. Run: bkper auth login'
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });

    it('should print login guidance for bkper-js login required errors', async function () {
        const consoleErrorStub = sinon.stub(console, 'error');
        const exitError = new Error('process.exit(1)');
        const processExitStub = sinon.stub(process, 'exit').throws(exitError);

        const action = withAction(
            'listing books',
            async () => {
                throw new BkperError(403, 'Login Required.', 'forbidden');
            },
            { skipSetup: true }
        );

        try {
            await action();
            expect.fail('Expected action to exit');
        } catch (err) {
            expect(err).to.equal(exitError);
        }

        expect(
            consoleErrorStub.calledWith(
                'Error listing books: Authentication required. Run: bkper auth login'
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });
});
