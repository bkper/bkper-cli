import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { BkperError } from 'bkper-js';

// Import after mock setup
const { batchCreateTransactions } = await import(
    '../../../../src/commands/transactions/batch-create.js'
);

describe('CLI - transaction batch-create Command', function () {
    let mockBook: any;
    let batchCalls: any[][];
    let accountLookups: string[];
    let consoleOutput: string[];

    beforeEach(function () {
        setupTestEnvironment();
        batchCalls = [];
        accountLookups = [];
        consoleOutput = [];

        const originalLog = console.log;
        console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };

        mockBook = {
            getDecimalSeparator: () => 'DOT',
            getAccount: async (nameOrId: string) => {
                accountLookups.push(nameOrId);
                if (nameOrId.startsWith('Missing')) {
                    throw new BkperError(404, `Account NOT found! ID: ${nameOrId}`);
                }
                return { getId: () => `${nameOrId}-id`, getName: () => nameOrId };
            },
            batchCreateTransactions: async (transactions: any[]) => {
                batchCalls.push(transactions);
                return transactions.map((_: any, idx: number) => ({
                    json: () => ({ id: `tx-${idx}`, amount: '100' }),
                    getCreditAccount: async () => undefined,
                    getDebitAccount: async () => undefined,
                }));
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        afterEach(() => {
            console.log = originalLog;
        });
    });

    it('should create a single transaction', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100', description: 'Test' },
        ]);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0]).to.have.length(1);
    });

    it('should output created transactions in an items envelope', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100' },
            { date: '2024-01-16', amount: '200' },
        ]);

        expect(consoleOutput).to.have.length(1);
        const parsed = JSON.parse(consoleOutput[0]);
        expect(parsed).to.have.property('items').that.is.an('array').with.length(2);
        parsed.items.forEach((item: unknown) => expect(item).to.have.property('id'));
    });

    it('should send all items in a single batch call', async function () {
        const items = Array.from({ length: 150 }, (_, i) => ({
            date: '2024-01-15',
            amount: String(i + 1),
        }));
        await batchCreateTransactions('book-123', items);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0]).to.have.length(150);
    });

    it('should set properties from stdin payload', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100', properties: { category: 'travel' } },
        ]);

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0][0];
        expect(tx.getProperty('category')).to.equal('travel');
    });

    it('should apply property overrides from CLI flags', async function () {
        await batchCreateTransactions(
            'book-123',
            [{ date: '2024-01-15', amount: '100' }],
            ['source=import']
        );

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0][0];
        expect(tx.getProperty('source')).to.equal('import');
    });

    // The batch API reads Account ids only and silently drops name-only references.
    it('should send Accounts referenced by name as their ids', async function () {
        await batchCreateTransactions('book-123', [
            {
                date: '2024-01-15',
                amount: '100',
                creditAccount: { name: 'Cash' },
                debitAccount: { name: 'Expenses' },
            },
        ]);

        expect(batchCalls).to.have.length(1);
        const json = batchCalls[0][0].json();
        expect(json.creditAccount?.id).to.equal('Cash-id');
        expect(json.debitAccount?.id).to.equal('Expenses-id');
    });

    it('should look up each distinct Account name once, and never an Account given by id', async function () {
        const line = (day: number) => ({
            date: `2024-01-${day}`,
            amount: '10',
            creditAccount: { name: 'Cash' },
            debitAccount: { name: 'Expenses' },
        });
        await batchCreateTransactions('book-123', [
            line(10),
            line(11),
            line(12),
            {
                date: '2024-01-13',
                amount: '5',
                creditAccount: { id: 'bank-id' },
                debitAccount: { name: 'Cash' },
            },
        ]);

        expect([...accountLookups].sort()).to.deep.equal(['Cash', 'Expenses']);
        expect(batchCalls[0][3].json().creditAccount.id).to.equal('bank-id');
    });

    it('should create nothing when a referenced Account does not exist', async function () {
        let error: Error | undefined;
        try {
            await batchCreateTransactions('book-123', [
                {
                    date: '2024-01-15',
                    amount: '100',
                    creditAccount: { name: 'Cash' },
                    debitAccount: { name: 'Expenses' },
                },
                {
                    date: '2024-01-16',
                    amount: '50',
                    creditAccount: { name: 'Missing' },
                    debitAccount: { name: 'Missing Too' },
                },
            ]);
        } catch (err) {
            error = err as Error;
        }

        expect(error?.message).to.include('item[1]: Credit account (from) not found: Missing');
        expect(error?.message).to.include('item[1]: Debit account (to) not found: Missing Too');
        expect(batchCalls).to.have.length(0);
    });

    it('should set description when provided', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '50', description: 'Coffee' },
        ]);

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0][0];
        expect(tx.getDescription()).to.equal('Coffee');
    });
});
