import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { listCollections } = await import('../../../../src/commands/collections/list.js');

describe('CLI - collection list Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should return all collections', async function () {
        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [
                {
                    getId: () => 'col-1',
                    getName: () => 'Collection 1',
                    getBooks: () => [],
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

        const result = await listCollections();
        expect(result).to.have.length(2);
    });

    it('should return empty array when no collections exist', async function () {
        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [],
        });

        const result = await listCollections();
        expect(result).to.be.an('array');
        expect(result).to.have.length(0);
    });
});
