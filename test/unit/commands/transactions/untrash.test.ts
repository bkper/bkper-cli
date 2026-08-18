import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { untrashTransaction } = await import('../../../../src/commands/transactions/untrash.js');

describe('CLI - transaction untrash Command', function () {
    let untrashCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        untrashCalled = false;

        const mockBook = {
            json: () => ({}),
            getTransaction: async (id: string) => {
                if (id === 'not-found') return undefined;
                return {
                    getId: () => 'tx-123',
                    untrash: async function () {
                        untrashCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'tx-123', trashed: false }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should untrash transaction and call untrash', async function () {
        await untrashTransaction('book-123', 'tx-123');
        expect(untrashCalled).to.be.true;
    });

    it('should return the restored transaction', async function () {
        const result = await untrashTransaction('book-123', 'tx-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when transaction not found', async function () {
        try {
            await untrashTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
