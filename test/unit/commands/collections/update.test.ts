import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { updateCollection } = await import('../../../../src/commands/collections/update.js');

describe('CLI - collection update Command', function () {
    let updatedCollection: any;

    beforeEach(function () {
        setupTestEnvironment();

        updatedCollection = {
            getId: () => 'col-1',
            getName: () => 'Original Name',
            setName: function (name: string) {
                this._newName = name;
                return this;
            },
            update: async function () {
                this._updated = true;
                return this;
            },
            json: () => ({ id: 'col-1', name: 'Original Name' }),
        };

        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [updatedCollection],
        });
    });

    it('should update a collection name', async function () {
        await updateCollection('col-1', { name: 'New Name' });
        expect(updatedCollection._newName).to.equal('New Name');
        expect(updatedCollection._updated).to.be.true;
    });

    it('should throw when collection not found', async function () {
        try {
            await updateCollection('col-nonexistent', { name: 'New Name' });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Collection not found');
        }
    });
});
