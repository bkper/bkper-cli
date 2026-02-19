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

    it('should auto-paginate across multiple pages', async function () {
        let callCount = 0;

        mockBook = {
            listTransactions: async (_q?: string, _l?: number, cursor?: string) => {
                callCount++;
                if (callCount === 1) {
                    // First page: return items + cursor
                    return {
                        getItems: () => [
                            { getId: () => 'tx-1', json: () => ({ id: 'tx-1', amount: '100' }) },
                            { getId: () => 'tx-2', json: () => ({ id: 'tx-2', amount: '200' }) },
                        ],
                        getAccount: async () => null,
                        getCursor: () => 'page-2-cursor',
                    };
                } else {
                    // Second page: return items + no cursor (last page)
                    return {
                        getItems: () => [
                            { getId: () => 'tx-3', json: () => ({ id: 'tx-3', amount: '300' }) },
                        ],
                        getAccount: async () => null,
                        getCursor: () => undefined,
                    };
                }
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listTransactions('book-123', { query: 'some query' });
        expect(callCount).to.equal(2);
        expect(result.items).to.have.length(3);
        expect(result.items[0].getId()).to.equal('tx-1');
        expect(result.items[1].getId()).to.equal('tx-2');
        expect(result.items[2].getId()).to.equal('tx-3');
    });

    it('should not have cursor in the result', async function () {
        mockBook = {
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

        const result = await listTransactions('book-123', { query: 'some query' });
        expect(result).to.not.have.property('cursor');
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
