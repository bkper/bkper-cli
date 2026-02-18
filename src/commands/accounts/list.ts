import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountsDataTableBuilder } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';

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
 * Absorbs AccountsDataTableBuilder config and JSON mapping.
 */
export async function listAccountsFormatted(
    bookId: string,
    format: OutputFormat
): Promise<ListResult> {
    const accounts = await listAccounts(bookId);

    if (format === 'json') {
        return { kind: 'json', data: accounts.map(a => a.json()) };
    }

    const builder = new AccountsDataTableBuilder(accounts).ids(true).groups(true);
    if (format === 'csv') {
        builder.properties(true).hiddenProperties(true);
    }
    const matrix = await builder.build();
    return { kind: 'matrix', matrix };
}
