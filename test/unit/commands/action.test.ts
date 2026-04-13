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

    it('should print API message for unauthorized errors without stack trace', async function () {
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
            consoleErrorStub.calledOnceWithExactly(
                'Error listing books: Invalid or expired token'
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });

    it('should print API message for forbidden bkper-js errors without stack trace', async function () {
        const consoleErrorStub = sinon.stub(console, 'error');
        const exitError = new Error('process.exit(1)');
        const processExitStub = sinon.stub(process, 'exit').throws(exitError);

        const action = withAction(
            'syncing app',
            async () => {
                throw new BkperError(403, "You don't have access to this app", 'forbidden');
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
            consoleErrorStub.calledOnceWithExactly(
                "Error syncing app: You don't have access to this app"
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });

    it('should print API message for app access 401 errors without login guidance', async function () {
        const consoleErrorStub = sinon.stub(console, 'error');
        const exitError = new Error('process.exit(1)');
        const processExitStub = sinon.stub(process, 'exit').throws(exitError);

        const action = withAction(
            'syncing app',
            async () => {
                throw new BkperError(
                    401,
                    'User test-user not a developer or owner of App inventory-bot',
                    'required'
                );
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
            consoleErrorStub.calledOnceWithExactly(
                'Error syncing app: User test-user not a developer or owner of App inventory-bot'
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });

    it('should print API message for bkper-js login required errors', async function () {
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
            consoleErrorStub.calledOnceWithExactly('Error listing books: Login Required.')
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });

    it('should print plain error messages without stack trace', async function () {
        const consoleErrorStub = sinon.stub(console, 'error');
        const exitError = new Error('process.exit(1)');
        const processExitStub = sinon.stub(process, 'exit').throws(exitError);

        const action = withAction(
            'syncing app',
            async () => {
                throw new Error('App config is missing "id" field');
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
            consoleErrorStub.calledOnceWithExactly(
                'Error syncing app: App config is missing "id" field'
            )
        ).to.be.true;
        expect(processExitStub.calledWith(1)).to.be.true;
    });
});
