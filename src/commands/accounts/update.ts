import { getBkperInstance } from '../../bkper-factory.js';
import { AccountType } from 'bkper-js';

export interface UpdateAccountOptions {
    name?: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    archived?: boolean;
    properties?: Record<string, string>;
}

export async function updateAccount(
    bookId: string,
    accountIdOrName: string,
    options: UpdateAccountOptions
): Promise<bkper.Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }

    if (options.name !== undefined) account.setName(options.name);
    if (options.type !== undefined) account.setType(options.type as AccountType);
    if (options.archived !== undefined) account.setArchived(options.archived);
    if (options.properties !== undefined) account.setProperties(options.properties);

    const updated = await account.update();
    return updated.json();
}
