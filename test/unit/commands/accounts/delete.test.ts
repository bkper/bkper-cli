import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { deleteAccount } = await import('../../../../src/commands/accounts/delete.js');

describe('CLI - account delete Command', function () {
    let mockBook: any;
    let removeCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        removeCalled = false;

        mockBook = {
            getAccount: async (idOrName: string) => {
                if (idOrName === 'not-found') return undefined;
                return {
                    getId: () => 'acc-123',
                    getName: () => 'OldAccount',
                    remove: async function () {
                        removeCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'acc-123', name: 'OldAccount' }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should delete account and call remove', async function () {
        await deleteAccount('book-123', 'acc-123');
        expect(removeCalled).to.be.true;
    });

    it('should return the removed account', async function () {
        const result = await deleteAccount('book-123', 'acc-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when account not found', async function () {
        try {
            await deleteAccount('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Account not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
