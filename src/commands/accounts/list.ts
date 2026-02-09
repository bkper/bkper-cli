import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';

export async function listAccounts(bookId: string): Promise<Account[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const accounts = await book.getAccounts();
    return accounts || [];
}
