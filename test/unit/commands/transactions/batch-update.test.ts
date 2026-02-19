import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { batchUpdateTransactions } = await import(
    '../../../../src/commands/transactions/batch-update.js'
);

describe('CLI - transaction batch-update Command', function () {
    let mockBook: any;
    let batchCalls: { transactions: any[]; updateChecked?: boolean }[];
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
            batchUpdateTransactions: async (transactions: any[], updateChecked?: boolean) => {
                batchCalls.push({ transactions, updateChecked });
                return transactions.map((_: any, idx: number) => ({
                    json: () => ({ id: `tx-${idx}`, amount: '100', description: 'updated' }),
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

    it('should update a single transaction', async function () {
        await batchUpdateTransactions('book-123', [
            { id: 'tx-1', date: '2024-01-15', amount: '100', description: 'Updated' },
        ]);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0].transactions).to.have.length(1);
    });

    it('should output flat JSON array for updated transactions', async function () {
        await batchUpdateTransactions('book-123', [
            { id: 'tx-1', date: '2024-01-15', amount: '100' },
            { id: 'tx-2', date: '2024-01-16', amount: '200' },
        ]);

        expect(consoleOutput).to.have.length(1);
        const parsed = JSON.parse(consoleOutput[0]);
        expect(parsed).to.be.an('array').with.length(2);
        expect(parsed[0]).to.have.property('id');
        expect(parsed[1]).to.have.property('id');
    });

    it('should send all items in a single batch call', async function () {
        const items = Array.from({ length: 150 }, (_, i) => ({
            id: `tx-${i}`,
            date: '2024-01-15',
            amount: String(i + 1),
        }));
        await batchUpdateTransactions('book-123', items);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0].transactions).to.have.length(150);
    });

    it('should throw when items are missing id field', async function () {
        try {
            await batchUpdateTransactions('book-123', [
                { date: '2024-01-15', amount: '100' },
                { id: 'tx-2', date: '2024-01-16', amount: '200' },
                { date: '2024-01-17', amount: '300' },
            ]);
            expect.fail('should have thrown');
        } catch (err: unknown) {
            const message = (err as Error).message;
            expect(message).to.include('item[0]');
            expect(message).to.include('item[2]');
            expect(message).not.to.include('item[1]');
        }
    });

    it('should set properties from stdin payload', async function () {
        await batchUpdateTransactions('book-123', [
            { id: 'tx-1', date: '2024-01-15', amount: '100', properties: { category: 'travel' } },
        ]);

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0].transactions[0];
        expect(tx.getProperty('category')).to.equal('travel');
    });

    it('should apply property overrides from CLI flags', async function () {
        await batchUpdateTransactions(
            'book-123',
            [{ id: 'tx-1', date: '2024-01-15', amount: '100' }],
            ['source=import']
        );

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0].transactions[0];
        expect(tx.getProperty('source')).to.equal('import');
    });

    it('should pass updateChecked flag to the API', async function () {
        await batchUpdateTransactions(
            'book-123',
            [{ id: 'tx-1', date: '2024-01-15', amount: '100' }],
            undefined,
            true
        );

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0].updateChecked).to.equal(true);
    });

    it('should default updateChecked to undefined', async function () {
        await batchUpdateTransactions('book-123', [
            { id: 'tx-1', date: '2024-01-15', amount: '100' },
        ]);

        expect(batchCalls).to.have.length(1);
        expect(batchCalls[0].updateChecked).to.be.undefined;
    });

    it('should set description when provided', async function () {
        await batchUpdateTransactions('book-123', [
            { id: 'tx-1', date: '2024-01-15', amount: '50', description: 'Updated Coffee' },
        ]);

        expect(batchCalls).to.have.length(1);
        const tx = batchCalls[0].transactions[0];
        expect(tx.getDescription()).to.equal('Updated Coffee');
    });
});
