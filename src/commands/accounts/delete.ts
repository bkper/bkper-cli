import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';

/**
 * Deletes an account from the specified book.
 *
 * @param bookId - The target book ID
 * @param accountIdOrName - Account ID or name to delete
 * @returns The removed account
 * @throws Error if the account is not found
 */
export async function deleteAccount(bookId: string, accountIdOrName: string): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }

    return account.remove();
}
