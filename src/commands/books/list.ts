import { getBkperInstance } from '../../bkper-factory.js';

export async function listBooks(query?: string): Promise<bkper.Book[]> {
    const bkper = getBkperInstance();
    const books = await bkper.getBooks(query);
    return books.map(book => book.json());
}
