import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

/**
 * Removes one or more books from a collection.
 *
 * @param collectionId - The ID of the collection to remove books from
 * @param bookIds - Array of book IDs to remove
 * @returns The books that were removed from the collection
 * @throws Error if the collection is not found
 */
export async function removeBookFromCollection(
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

    return collection.removeBooks(books);
}
