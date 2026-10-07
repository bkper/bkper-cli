import sinon from 'sinon';
import { Book, BotResponse } from 'bkper-js';
import { Command } from 'commander';
import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { registerEventCommands } from '../../../../src/commands/events/register.js';

function createProgram(): Command {
    const program = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    registerEventCommands(program);
    return program;
}

async function expectFailure(program: Command, args: string[]): Promise<void> {
    let error: unknown;
    try {
        await program.parseAsync(args, { from: 'user' });
    } catch (err) {
        error = err;
    }
    expect(error).to.be.instanceOf(Error);
}

describe('CLI - event response commands', function () {
    const book = new Book({ id: 'book-123' });
    const updatedEvent: bkper.Event = {
        id: 'evt-1',
        type: 'TRANSACTION_POSTED',
        resource: 'tx-1',
        botResponses: [{ agentId: 'other-bot', type: 'INFO', message: 'untouched' }],
    };
    let getBook: sinon.SinonStub;
    let replay: sinon.SinonStub;
    let remove: sinon.SinonStub;
    let stdout: sinon.SinonStub;
    let stderr: sinon.SinonStub;

    beforeEach(function () {
        setupTestEnvironment();
        getBook = sinon.stub().resolves(book);
        setMockBkper({ setConfig: () => {}, getBook });
        const updateEvent = async function (this: BotResponse): Promise<BotResponse> {
            expect(this.getEvent().getBook()).to.equal(book);
            expect(this.getEvent().getId()).to.equal('evt-1');
            expect(this.getAgentId()).to.equal('tax-bot');
            this.getEvent().payload = updatedEvent;
            return this;
        };
        replay = sinon.stub(BotResponse.prototype, 'replay').callsFake(updateEvent);
        remove = sinon.stub(BotResponse.prototype, 'remove').callsFake(updateEvent);
        stdout = sinon.stub(console, 'log');
        stderr = sinon.stub(console, 'error');
        sinon.stub(process, 'exit').callsFake((code?: string | number | null): never => {
            throw new Error(`exit ${code}`);
        });
    });

    afterEach(function () {
        sinon.restore();
    });

    for (const operation of ['replay', 'delete']) {
        it(`should ${operation} only the selected response and output the updated event`, async function () {
            await createProgram().parseAsync(
                ['event', 'response', operation, 'evt-1', '-b', 'book-123', '--agent-id', 'tax-bot'],
                { from: 'user' }
            );

            expect(getBook.calledOnceWithExactly('book-123')).to.equal(true);
            expect(replay.callCount).to.equal(operation === 'replay' ? 1 : 0);
            expect(remove.callCount).to.equal(operation === 'delete' ? 1 : 0);
            expect(stdout.calledOnce).to.equal(true);
            expect(JSON.parse(stdout.firstCall.args[0])).to.deep.equal(updatedEvent);
            expect(stderr.called).to.equal(false);
        });

        for (const missing of ['eventId', 'book', 'agentId']) {
            it(`should reject ${operation} without ${missing} before writing`, async function () {
                const args = ['event', 'response', operation];
                if (missing !== 'eventId') args.push('evt-1');
                if (missing !== 'book') args.push('-b', 'book-123');
                if (missing !== 'agentId') args.push('--agent-id', 'tax-bot');

                await expectFailure(createProgram(), args);

                expect(getBook.called).to.equal(false);
                expect(replay.called).to.equal(false);
                expect(remove.called).to.equal(false);
                expect(stdout.called).to.equal(false);
            });
        }
    }

    it('should reject the removed flat replay command without writing', async function () {
        await expectFailure(createProgram(), [
            'event', 'replay', 'evt-1', '-b', 'book-123', '--agent-id', 'tax-bot',
        ]);

        expect(getBook.called).to.equal(false);
        expect(replay.called).to.equal(false);
        expect(remove.called).to.equal(false);
    });

    it('should report a failed deletion without emitting a success result or replaying', async function () {
        remove.rejects(new Error('Permission denied'));

        await expectFailure(createProgram(), [
            'event', 'response', 'delete', 'evt-1', '-b', 'book-123', '--agent-id', 'tax-bot',
        ]);

        expect(remove.calledOnce).to.equal(true);
        expect(replay.called).to.equal(false);
        expect(stdout.called).to.equal(false);
        expect(stderr.calledOnce).to.equal(true);
        expect(stderr.firstCall.args[0]).to.include('Permission denied');
    });
});
