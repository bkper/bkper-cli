import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

/**
 * Retrieves a single book by its ID.
 *
 * @param bookId - The unique identifier of the book to retrieve
 * @returns The requested Book instance
 */
export async function getBook(bookId: string): Promise<Book> {
    const bkper = getBkperInstance();
    return bkper.getBook(bookId);
}
