import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { getBook } = await import('../../../../src/commands/books/get.js');

describe('CLI - book get Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockBook = {
            getId: () => 'book-123',
            getName: () => 'My Ledger',
            json: () => ({ id: 'book-123', name: 'My Ledger' }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should return the book', async function () {
        const result = await getBook('book-123');
        expect(result).to.equal(mockBook);
    });

    it('should return proper json representation', async function () {
        const result = await getBook('book-123');
        const json = result.json();
        expect(json).to.deep.equal({ id: 'book-123', name: 'My Ledger' });
    });
});
