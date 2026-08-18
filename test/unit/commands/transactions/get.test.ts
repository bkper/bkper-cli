import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { getTransaction } = await import('../../../../src/commands/transactions/get.js');

describe('CLI - transaction get Command', function () {
    let requestedBookId: string | undefined;
    let requestedTransactionId: string | undefined;

    const mockTransaction = {
        getId: () => 'tx-123',
        json: () => ({ id: 'tx-123', description: 'Office supplies' }),
    };

    beforeEach(function () {
        setupTestEnvironment();
        requestedBookId = undefined;
        requestedTransactionId = undefined;

        setMockBkper({
            setConfig: () => {},
            getBook: async (bookId: string) => {
                requestedBookId = bookId;
                return {
                    getTransaction: async (transactionId: string) => {
                        requestedTransactionId = transactionId;
                        return transactionId === 'not-found' ? undefined : mockTransaction;
                    },
                };
            },
        });
    });

    it('should return transaction by id from the requested book', async function () {
        const result = await getTransaction('book-123', 'tx-123');

        expect(result).to.equal(mockTransaction);
        expect(requestedBookId).to.equal('book-123');
        expect(requestedTransactionId).to.equal('tx-123');
    });

    it('should throw when transaction not found', async function () {
        try {
            await getTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.equal('Transaction not found: not-found');
        }
    });
});
