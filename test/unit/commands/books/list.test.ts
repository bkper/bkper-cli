import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { listBooks } = await import('../../../../src/commands/books/list.js');

describe('CLI - book list Command', function () {
    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should return all books', async function () {
        const mockBooks = [
            {
                getId: () => 'book-1',
                getName: () => 'Ledger A',
                getCollection: () => null,
                json: () => ({ id: 'book-1', name: 'Ledger A' }),
            },
            {
                getId: () => 'book-2',
                getName: () => 'Ledger B',
                getCollection: () => null,
                json: () => ({ id: 'book-2', name: 'Ledger B' }),
            },
        ];

        setMockBkper({
            setConfig: () => {},
            getBooks: async () => mockBooks,
        });

        const result = await listBooks();
        expect(result).to.have.length(2);
        expect(result[0].getName()).to.equal('Ledger A');
        expect(result[1].getName()).to.equal('Ledger B');
    });

    it('should pass query to getBooks', async function () {
        let capturedQuery: string | undefined;

        setMockBkper({
            setConfig: () => {},
            getBooks: async (q?: string) => {
                capturedQuery = q;
                return [];
            },
        });

        await listBooks('my-query');
        expect(capturedQuery).to.equal('my-query');
    });

    it('should return empty array when no books exist', async function () {
        setMockBkper({
            setConfig: () => {},
            getBooks: async () => [],
        });

        const result = await listBooks();
        expect(result).to.deep.equal([]);
    });
});
