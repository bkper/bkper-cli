import { getBkperInstance } from '../../bkper-factory.js';

export async function deleteAccount(
    bookId: string,
    accountIdOrName: string
): Promise<bkper.Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }

    const removed = await account.remove();
    return removed.json();
}
