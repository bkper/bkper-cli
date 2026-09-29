import { expect } from '../../helpers/test-setup.js';
import type { Transaction } from 'bkper-js';
import { transactionToJson } from '../../../../src/commands/transactions/transaction-json.js';

interface MockAccount {
    getName: () => string;
}

function mockTransaction(
    payload: bkper.Transaction,
    accounts: { credit?: MockAccount; debit?: MockAccount }
): Transaction {
    const mock = {
        json: () => payload,
        getCreditAccount: async () => accounts.credit,
        getDebitAccount: async () => accounts.debit,
    };
    return mock as unknown as Transaction;
}

describe('transactionToJson', function () {
    const payload: bkper.Transaction = {
        id: 'tx-1',
        date: '2025-01-31',
        dateFormatted: '31/01/2025',
        dateValue: 20250131,
        amount: '4.44',
        description: 'Rent #office',
        creditAccount: { id: 'acc-bank' },
        debitAccount: { id: 'acc-rent' },
        agentId: 'bkper-sheets',
        agentName: 'Google Sheets Add-on',
        agentLogo: 'data:image/png;base64,AAAA',
        agentLogoDark: 'data:image/png;base64,BBBB',
        createdAt: '1744054220773',
        createdBy: 'jacob',
        posted: true,
        checked: true,
        tags: ['#office'],
        properties: { invoice: 'inv-1' },
    };

    it('should add account names to credit and debit accounts', async function () {
        const json = await transactionToJson(
            mockTransaction(payload, {
                credit: { getName: () => 'Bank' },
                debit: { getName: () => 'Rent' },
            })
        );

        expect(json.creditAccount).to.deep.equal({ id: 'acc-bank', name: 'Bank' });
        expect(json.debitAccount).to.deep.equal({ id: 'acc-rent', name: 'Rent' });
    });

    it('should drop inline agent logos', async function () {
        const json = await transactionToJson(mockTransaction(payload, {}));

        expect(json).to.not.have.property('agentLogo');
        expect(json).to.not.have.property('agentLogoDark');
    });

    it('should keep every other field unchanged', async function () {
        const json = await transactionToJson(mockTransaction(payload, {}));
        const { agentLogo: _logo, agentLogoDark: _logoDark, ...rest } = payload;

        expect(json).to.deep.equal(rest);
    });

    it('should not mutate the transaction payload', async function () {
        const original = structuredClone(payload);
        await transactionToJson(
            mockTransaction(payload, {
                credit: { getName: () => 'Bank' },
                debit: { getName: () => 'Rent' },
            })
        );

        expect(payload).to.deep.equal(original);
    });

    it('should leave draft transactions without accounts untouched', async function () {
        const draft: bkper.Transaction = { id: 'tx-draft', amount: '10', draft: true };
        const json = await transactionToJson(mockTransaction(draft, {}));

        expect(json).to.deep.equal(draft);
    });
});
