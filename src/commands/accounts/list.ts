import { getBkperInstance } from '../../bkper-factory.js';

export async function listAccounts(bookId: string): Promise<bkper.Account[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const accounts = await book.getAccounts();
    return accounts ? accounts.map(account => account.json()) : [];
}
