import { getBkperInstance } from '../../bkper-factory.js';

export async function getBook(bookId: string): Promise<bkper.Book> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    return book.json();
}
