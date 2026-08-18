import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { uncheckTransaction } = await import('../../../../src/commands/transactions/uncheck.js');

describe('CLI - transaction uncheck Command', function () {
    let uncheckCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        uncheckCalled = false;

        const mockBook = {
            json: () => ({}),
            getTransaction: async (id: string) => {
                if (id === 'not-found') return undefined;
                return {
                    getId: () => 'tx-123',
                    uncheck: async function () {
                        uncheckCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'tx-123', checked: false }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should uncheck transaction and call uncheck', async function () {
        await uncheckTransaction('book-123', 'tx-123');
        expect(uncheckCalled).to.be.true;
    });

    it('should return the unchecked transaction', async function () {
        const result = await uncheckTransaction('book-123', 'tx-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when transaction not found', async function () {
        try {
            await uncheckTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
