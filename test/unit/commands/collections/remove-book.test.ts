import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { removeBookFromCollection } =
    await import('../../../../src/commands/collections/remove-book.js');

describe('CLI - collection remove-book Command', function () {
    let removedBooks: any[];

    beforeEach(function () {
        setupTestEnvironment();
        removedBooks = [];

        setMockBkper({
            setConfig: () => {},
            getCollections: async () => [
                {
                    getId: () => 'col-1',
                    getName: () => 'Collection 1',
                    removeBooks: async (books: any[]) => {
                        removedBooks = books;
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

    it('should remove a book from a collection', async function () {
        await removeBookFromCollection('col-1', ['book-1']);
        expect(removedBooks).to.have.length(1);
    });

    it('should remove multiple books from a collection', async function () {
        await removeBookFromCollection('col-1', ['book-1', 'book-2']);
        expect(removedBooks).to.have.length(2);
    });

    it('should throw when collection not found', async function () {
        try {
            await removeBookFromCollection('col-nonexistent', ['book-1']);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('Collection not found');
        }
    });
});
