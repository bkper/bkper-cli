import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

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
