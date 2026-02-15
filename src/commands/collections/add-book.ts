import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

/**
 * Adds one or more books to a collection.
 *
 * @param collectionId - The ID of the collection to add books to
 * @param bookIds - Array of book IDs to add
 * @returns The books that were added to the collection
 * @throws Error if the collection is not found
 */
export async function addBookToCollection(
    collectionId: string,
    bookIds: string[]
): Promise<Book[]> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    const collection = collections.find(c => c.getId() === collectionId);

    if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
    }

    const books: Book[] = [];
    for (const bookId of bookIds) {
        const book = await bkper.getBook(bookId);
        books.push(book);
    }

    return collection.addBooks(books);
}
