import { expect } from '../../helpers/test-setup.js';
import { eventToJson } from '../../../../src/commands/events/event-json.js';

describe('eventToJson', function () {
    const event: bkper.Event = {
        id: 'evt-1',
        type: 'TRANSACTION_CREATED',
        resource: 'tx-1',
        agent: {
            id: 'bkper-sheets',
            name: 'Google Sheets Add-on',
            logo: 'data:image/png;base64,AAAA',
            logoDark: 'https://bkper.com/images/logo-dark.png',
        },
        user: { id: 'u1', avatarUrl: 'https://example.com/avatar.png' },
        data: {
            object: {
                transaction: {
                    id: 'tx-1',
                    amount: '10.00',
                    agentLogo: 'data:image/png;base64,BBBB',
                    agentLogoDark: 'data:image/png;base64,CCCC',
                    creditAccount: { id: 'acc-1' },
                },
            },
            previousAttributes: { amount: '5.00' },
        },
        botResponses: [{ agentId: 'tax-bot', type: 'ERROR', message: 'timeout' }],
    };

    it('should drop agent logos', function () {
        const json = eventToJson(event);

        expect(json.agent).to.deep.equal({ id: 'bkper-sheets', name: 'Google Sheets Add-on' });
    });

    it('should drop agent logos from the embedded transaction', function () {
        const json = eventToJson(event);

        expect(json.data?.object?.transaction).to.deep.equal({
            id: 'tx-1',
            amount: '10.00',
            creditAccount: { id: 'acc-1' },
        });
    });

    it('should keep every other field unchanged', function () {
        const json = eventToJson(event);

        expect(json.id).to.equal('evt-1');
        expect(json.user).to.deep.equal(event.user);
        expect(json.botResponses).to.deep.equal(event.botResponses);
        expect(json.data?.previousAttributes).to.deep.equal({ amount: '5.00' });
    });

    it('should not mutate the event payload', function () {
        const original = structuredClone(event);
        eventToJson(event);

        expect(event).to.deep.equal(original);
    });

    it('should leave events without agent or transaction data untouched', function () {
        const bookEvent: bkper.Event = {
            id: 'evt-2',
            type: 'BOOK_UPDATED',
            data: { object: { id: 'book-1', name: 'Finances' } },
        };

        expect(eventToJson(bookEvent)).to.deep.equal(bookEvent);
    });
});
