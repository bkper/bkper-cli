import sinon from 'sinon';
import { BotResponse } from 'bkper-js';
import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { replayEventBotResponse } = await import('../../../../src/commands/events/replay.js');

describe('CLI - event replay Command', function () {
    afterEach(function () {
        sinon.restore();
    });

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should replay a bot response for the given event and agent id', async function () {
        const mockBook = {
            json: () => ({ id: 'book-123' }),
            getId: () => 'book-123',
            getConfig: () => ({}),
        };
        let capturedBookId: string | undefined;

        setMockBkper({
            setConfig: () => {},
            getBook: async (bookId: string) => {
                capturedBookId = bookId;
                return mockBook;
            },
        });

        const replayStub = sinon.stub(BotResponse.prototype, 'replay').callsFake(async function (
            this: BotResponse
        ) {
            this.getEvent().payload = {
                id: 'evt-1',
                type: 'TRANSACTION_POSTED',
                botResponses: [
                    {
                        agentId: 'tax-bot',
                        type: 'INFO',
                        message: 'recovered',
                    },
                ],
            };
            return this;
        });

        const event = await replayEventBotResponse('book-123', 'evt-1', 'tax-bot');

        expect(capturedBookId).to.equal('book-123');
        expect(replayStub.calledOnce).to.equal(true);
        expect(event.json()).to.deep.equal({
            id: 'evt-1',
            type: 'TRANSACTION_POSTED',
            botResponses: [
                {
                    agentId: 'tax-bot',
                    type: 'INFO',
                    message: 'recovered',
                },
            ],
        });
    });
});
