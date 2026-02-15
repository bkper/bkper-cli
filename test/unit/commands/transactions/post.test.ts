import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { postTransaction } = await import('../../../../src/commands/transactions/post.js');

describe('CLI - transaction post Command', function () {
    let mockBook: any;
    let postCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        postCalled = false;

        mockBook = {
            getTransaction: async (id: string) => {
                if (id === 'not-found') return undefined;
                return {
                    getId: () => 'tx-123',
                    post: async function () {
                        postCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'tx-123', posted: true }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should post transaction and call post', async function () {
        await postTransaction('book-123', 'tx-123');
        expect(postCalled).to.be.true;
    });

    it('should return the posted transaction', async function () {
        const result = await postTransaction('book-123', 'tx-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when transaction not found', async function () {
        try {
            await postTransaction('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Transaction not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
