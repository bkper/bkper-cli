import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { countTransactions } = await import('../../../../src/commands/transactions/count.js');

describe('CLI - transaction count Command', function () {
    let requestedBookId: string | undefined;
    let requestedQuery: string | undefined;
    let total: number | undefined;
    let listCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        requestedBookId = undefined;
        requestedQuery = undefined;
        total = 42;
        listCalled = false;

        setMockBkper({
            setConfig: () => {},
            getBook: async (bookId: string) => {
                requestedBookId = bookId;
                return {
                    json: () => ({ id: bookId }),
                    countTransactions: async (query?: string) => {
                        requestedQuery = query;
                        return total;
                    },
                    listTransactions: async () => {
                        listCalled = true;
                        throw new Error('count must not list transactions');
                    },
                };
            },
        });
    });

    it('should return the count from the count endpoint without listing', async function () {
        const result = await countTransactions('book-123', "account:'Equity' after:2025-01-01");

        expect(result).to.deep.equal({ count: 42 });
        expect(requestedBookId).to.equal('book-123');
        expect(requestedQuery).to.equal("account:'Equity' after:2025-01-01");
        expect(listCalled).to.equal(false);
    });

    it('should count all transactions when no query is given', async function () {
        const result = await countTransactions('book-123');

        expect(result).to.deep.equal({ count: 42 });
        expect(requestedQuery).to.equal(undefined);
    });

    it('should return zero when the API omits the total', async function () {
        total = undefined;

        const result = await countTransactions('book-123', 'account:Empty');

        expect(result).to.deep.equal({ count: 0 });
    });
});
