import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { trashTransaction } = await import('../../../../src/commands/transactions/trash.js');

describe('CLI - transaction trash Command', function () {
    let mockBook: any;
    let trashCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        trashCalled = false;

        mockBook = {
            getTransaction: async (id: string) => {
                if (id === 'not-found') return undefined;
                return {
                    getId: () => 'tx-123',
                    trash: async function () {
                        trashCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'tx-123', trashed: true }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should trash transaction and call trash', async function () {
        await trashTransaction('book-123', 'tx-123');
        expect(trashCalled).to.be.true;
    });

    it('should return the trashed transaction', async function () {
        const result = await trashTransaction('book-123', 'tx-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when transaction not found', async function () {
        try {
            await trashTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
