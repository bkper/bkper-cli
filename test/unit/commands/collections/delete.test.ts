import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { deleteCollection } = await import('../../../../src/commands/collections/delete.js');

describe('CLI - collection delete Command', function () {
    let removeCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        removeCalled = false;

        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [
                {
                    getId: () => 'col-1',
                    getName: () => 'Collection 1',
                    remove: async () => {
                        removeCalled = true;
                        return [];
                    },
                    json: () => ({ id: 'col-1', name: 'Collection 1' }),
                },
            ],
        });
    });

    it('should delete a collection', async function () {
        await deleteCollection('col-1');
        expect(removeCalled).to.be.true;
    });

    it('should throw when collection not found', async function () {
        try {
            await deleteCollection('col-nonexistent');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Collection not found');
        }
    });
});
