import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { getCollection } = await import('../../../../src/commands/collections/get.js');

describe('CLI - collection get Command', function () {
    beforeEach(function () {
        setupTestEnvironment();

        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [
                {
                    getId: () => 'col-1',
                    getName: () => 'Collection 1',
                    getBooks: () => [
                        {
                            getId: () => 'book-1',
                            getName: () => 'Book A',
                            json: () => ({ id: 'book-1', name: 'Book A' }),
                        },
                    ],
                    json: () => ({ id: 'col-1', name: 'Collection 1' }),
                },
                {
                    getId: () => 'col-2',
                    getName: () => 'Collection 2',
                    getBooks: () => [],
                    json: () => ({ id: 'col-2', name: 'Collection 2' }),
                },
            ],
        });
    });

    it('should return a collection by ID', async function () {
        const result = await getCollection('col-1');
        expect(result).to.exist;
        expect(result.getId()).to.equal('col-1');
    });

    it('should throw when collection not found', async function () {
        try {
            await getCollection('col-nonexistent');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Collection not found');
        }
    });
});
