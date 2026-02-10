import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountType } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface CreateAccountOptions {
    name: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    description?: string;
    groups?: string[];
    property?: string[];
}

export async function createAccount(
    bookId: string,
    options: CreateAccountOptions
): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const account = new Account(book).setName(options.name);

    if (options.type) account.setType(options.type as AccountType);

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

    if (options.groups) {
        for (const groupName of options.groups) {
            const group = await book.getGroup(groupName);
            if (group) {
                account.addGroup(group);
            }
        }
    }

    return account.create();
}
