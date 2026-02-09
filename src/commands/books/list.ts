import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

export async function listBooks(query?: string): Promise<Book[]> {
    const bkper = getBkperInstance();
    return bkper.getBooks(query);
}
