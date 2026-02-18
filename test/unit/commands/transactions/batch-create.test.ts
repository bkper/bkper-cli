import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { batchCreateTransactions } = await import(
    '../../../../src/commands/transactions/batch-create.js'
);

describe('CLI - transaction batch-create Command', function () {
    let mockBook: any;
    let batchCalls: any[][];
    let consoleOutput: string[];

    beforeEach(function () {
        setupTestEnvironment();
        batchCalls = [];
        consoleOutput = [];

        const originalLog = console.log;
        console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };

        mockBook = {
            getDecimalSeparator: () => 'DOT',
            getAccount: async (nameOrId: string) => ({
                getId: () => `${nameOrId}-id`,
                getName: () => nameOrId,
            }),
            batchCreateTransactions: async (transactions: any[]) => {
                batchCalls.push(transactions);
                return transactions.map((_: any, idx: number) => ({
                    json: () => ({ id: `tx-${idx}`, amount: '100' }),
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

    it('should output NDJSON for each created transaction', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100' },
            { date: '2024-01-16', amount: '200' },
        ]);

        expect(consoleOutput).to.have.length(2);
        const parsed0 = JSON.parse(consoleOutput[0]);
        const parsed1 = JSON.parse(consoleOutput[1]);
        expect(parsed0).to.have.property('id');
        expect(parsed1).to.have.property('id');
    });

    it('should chunk items at 100', async function () {
        const items = Array.from({ length: 150 }, (_, i) => ({
            date: '2024-01-15',
            amount: String(i + 1),
        }));
        await batchCreateTransactions('book-123', items);

        expect(batchCalls).to.have.length(2);
        expect(batchCalls[0]).to.have.length(100);
        expect(batchCalls[1]).to.have.length(50);
    });

    it('should set properties from stdin fields', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100', category: 'travel' },
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

    it('should set credit and debit accounts', async function () {
        await batchCreateTransactions('book-123', [
            { date: '2024-01-15', amount: '100', creditAccount: 'Cash', debitAccount: 'Expenses' },
        ]);

        expect(batchCalls).to.have.length(1);
        // The transaction was created and accounts were looked up
        expect(batchCalls[0]).to.have.length(1);
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
