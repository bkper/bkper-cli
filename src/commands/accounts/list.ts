import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';
import type { ListResult } from '../../render/output.js';

/**
 * Retrieves all accounts from the specified book.
 *
 * @param bookId - The target book ID
 * @returns Array of accounts, or empty array if none exist
 */
export async function listAccounts(bookId: string): Promise<Account[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId, true, true);
    const accounts = await book.getAccounts();
    return accounts || [];
}

/**
 * Lists accounts and returns a ListResult ready for rendering.
 */
export async function listAccountsFormatted(bookId: string): Promise<ListResult> {
    const accounts = await listAccounts(bookId);
    return { items: accounts.map(a => a.json()) };
}
