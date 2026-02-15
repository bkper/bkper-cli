import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { deleteGroup } = await import('../../../../src/commands/groups/delete.js');

describe('CLI - group delete Command', function () {
    let mockBook: any;
    let removeCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        removeCalled = false;

        mockBook = {
            getGroup: async (idOrName: string) => {
                if (idOrName === 'not-found') return undefined;
                return {
                    getId: () => 'grp-123',
                    getName: () => 'OldGroup',
                    remove: async function () {
                        removeCalled = true;
                        return this;
                    },
                    json: () => ({ id: 'grp-123', name: 'OldGroup' }),
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should delete group and call remove', async function () {
        await deleteGroup('book-123', 'grp-123');
        expect(removeCalled).to.be.true;
    });

    it('should return the removed group', async function () {
        const result = await deleteGroup('book-123', 'grp-123');
        expect(result).to.have.property('getId');
    });

    it('should throw when group not found', async function () {
        try {
            await deleteGroup('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Group not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
