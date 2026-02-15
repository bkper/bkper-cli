import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';

/**
 * Retrieves a single account by ID or name from the specified book.
 *
 * @param bookId - The target book ID
 * @param accountIdOrName - Account ID or name to look up
 * @returns The matching account
 * @throws Error if the account is not found
 */
export async function getAccount(bookId: string, accountIdOrName: string): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }
    return account;
}
