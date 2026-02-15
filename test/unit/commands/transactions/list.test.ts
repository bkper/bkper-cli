import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { listTransactions } = await import('../../../../src/commands/transactions/list.js');

describe('CLI - transaction list Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should return transactions matching query', async function () {
        const mockItems = [
            { getId: () => 'tx-1', json: () => ({ id: 'tx-1', amount: '100' }) },
            { getId: () => 'tx-2', json: () => ({ id: 'tx-2', amount: '200' }) },
        ];

        mockBook = {
            listTransactions: async () => ({
                getItems: () => mockItems,
                getAccount: async () => null,
                getCursor: () => undefined,
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: 'after:2024-01-01' });
        expect(result.items).to.have.length(2);
        expect(result.items[0].getId()).to.equal('tx-1');
        expect(result.items[1].getId()).to.equal('tx-2');
    });

    it('should return empty array when no transactions match', async function () {
        mockBook = {
            listTransactions: async () => ({
                getItems: () => null,
                getAccount: async () => null,
                getCursor: () => undefined,
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: 'after:2099-01-01' });
        expect(result.items).to.deep.equal([]);
    });

    it('should return cursor for pagination', async function () {
        mockBook = {
            listTransactions: async () => ({
                getItems: () => [],
                getAccount: async () => null,
                getCursor: () => 'next-page-cursor',
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: 'some query' });
        expect(result.cursor).to.equal('next-page-cursor');
    });

    it('should return account when available', async function () {
        const mockAccount = {
            getId: () => 'acc-123',
            getName: () => 'Checking',
        };

        mockBook = {
            listTransactions: async () => ({
                getItems: () => [],
                getAccount: async () => mockAccount,
                getCursor: () => undefined,
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: 'account:Checking' });
        expect(result.account).to.exist;
        expect(result.account!.getName()).to.equal('Checking');
    });

    it('should pass limit and cursor to listTransactions', async function () {
        let capturedQuery: string | undefined;
        let capturedLimit: number | undefined;
        let capturedCursor: string | undefined;

        mockBook = {
            listTransactions: async (q?: string, l?: number, c?: string) => {
                capturedQuery = q;
                capturedLimit = l;
                capturedCursor = c;
                return {
                    getItems: () => [],
                    getAccount: async () => null,
                    getCursor: () => undefined,
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        await listTransactions('book-123', {
            query: 'test query',
            limit: 50,
            cursor: 'page-2',
        });

        expect(capturedQuery).to.equal('test query');
        expect(capturedLimit).to.equal(50);
        expect(capturedCursor).to.equal('page-2');
    });

    it('should return the book in the result', async function () {
        mockBook = {
            getId: () => 'book-123',
            listTransactions: async () => ({
                getItems: () => [],
                getAccount: async () => null,
                getCursor: () => undefined,
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: '' });
        expect(result.book).to.equal(mockBook);
    });
});
