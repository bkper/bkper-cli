import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountType } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface UpdateAccountOptions {
    name?: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    archived?: boolean;
    property?: string[];
}

export async function updateAccount(
    bookId: string,
    accountIdOrName: string,
    options: UpdateAccountOptions
): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const account = await book.getAccount(accountIdOrName);
    if (!account) {
        throw new Error(`Account not found: ${accountIdOrName}`);
    }

    if (options.name !== undefined) account.setName(options.name);
    if (options.type !== undefined) account.setType(options.type as AccountType);
    if (options.archived !== undefined) account.setArchived(options.archived);

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            if (value === '') {
                account.deleteProperty(key);
            } else {
                account.setProperty(key, value);
            }
        }
    }

    return account.update();
}
