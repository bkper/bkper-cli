import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';

export async function deleteAccount(bookId: string, accountIdOrName: string): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }

    return account.remove();
}
