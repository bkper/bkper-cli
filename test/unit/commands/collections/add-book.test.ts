import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { addBookToCollection } = await import('../../../../src/commands/collections/add-book.js');

describe('CLI - collection add-book Command', function () {
    let addedBooks: any[];

    beforeEach(function () {
        setupTestEnvironment();
        addedBooks = [];

        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [
                {
                    getId: () => 'col-1',
                    getName: () => 'Collection 1',
                    addBooks: async (books: any[]) => {
                        addedBooks = books;
                        return books;
                    },
                    json: () => ({ id: 'col-1', name: 'Collection 1' }),
                },
            ],
            getBook: async (id: string) => ({
                getId: () => id,
                getName: () => `Book ${id}`,
                json: () => ({ id, name: `Book ${id}` }),
            }),
        });
    });

    it('should add a book to a collection', async function () {
        await addBookToCollection('col-1', ['book-1']);
        expect(addedBooks).to.have.length(1);
    });

    it('should add multiple books to a collection', async function () {
        await addBookToCollection('col-1', ['book-1', 'book-2']);
        expect(addedBooks).to.have.length(2);
    });

    it('should throw when collection not found', async function () {
        try {
            await addBookToCollection('col-nonexistent', ['book-1']);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Collection not found');
        }
    });
});
