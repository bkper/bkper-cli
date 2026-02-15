import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { checkTransaction } = await import('../../../../src/commands/transactions/check.js');

describe('CLI - transaction check Command', function () {
    let mockBook: any;
    let checkCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        checkCalled = false;

        mockBook = {
            getTransaction: async (id: string) => {
                if (id === 'not-found') return undefined;
                return {
                    getId: () => 'tx-123',
                    check: async function () {
                        checkCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'tx-123', checked: true }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should check transaction and call check', async function () {
        await checkTransaction('book-123', 'tx-123');
        expect(checkCalled).to.be.true;
    });

    it('should return the checked transaction', async function () {
        const result = await checkTransaction('book-123', 'tx-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when transaction not found', async function () {
        try {
            await checkTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
