import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { listGroups } = await import('../../../../src/commands/groups/list.js');

describe('CLI - group list Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should return all groups', async function () {
        const mockGroups = [
            {
                getId: () => 'grp-1',
                getName: () => 'Assets',
                json: () => ({ id: 'grp-1', name: 'Assets' }),
            },
            {
                getId: () => 'grp-2',
                getName: () => 'Expenses',
                json: () => ({ id: 'grp-2', name: 'Expenses' }),
            },
        ];

        mockBook = {
            getGroups: async () => mockGroups,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listGroups('book-123');
        expect(result).to.have.length(2);
        expect(result[0].getName()).to.equal('Assets');
        expect(result[1].getName()).to.equal('Expenses');
    });

    it('should return empty array when no groups exist', async function () {
        mockBook = {
            getGroups: async () => null,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listGroups('book-123');
        expect(result).to.deep.equal([]);
    });

    it('should return empty array for undefined groups', async function () {
        mockBook = {
            getGroups: async () => undefined,
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listGroups('book-123');
        expect(result).to.deep.equal([]);
    });
});
