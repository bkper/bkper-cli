import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

export async function getBook(bookId: string): Promise<Book> {
    const bkper = getBkperInstance();
    return bkper.getBook(bookId);
}
