import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountType } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { throwIfErrors } from '../../utils/validation.js';

/**
 * Options for creating a new account in a book.
 *
 * @property name - The account name
 * @property type - Account type classification
 * @property description - Optional account description
 * @property groups - Group names to associate with the account
 * @property property - Custom properties in "key=value" format
 */
export interface CreateAccountOptions {
    name: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    description?: string;
    groups?: string[];
    property?: string[];
}

/**
 * Creates a new account in the specified book.
 * Validates groups and properties before creation.
 *
 * @param bookId - The target book ID
 * @param options - Account creation options
 * @returns The newly created account
 */
export async function createAccount(
    bookId: string,
    options: CreateAccountOptions
): Promise<Account> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const errors: string[] = [];

    const account = new Account(book).setName(options.name);

    if (options.type) account.setType(options.type as AccountType);

    if (options.property) {
        for (const raw of options.property) {
            try {
                const [key, value] = parsePropertyFlag(raw);
                if (value === '') {
                    account.deleteProperty(key);
                } else {
                    account.setProperty(key, value);
                }
            } catch (err: unknown) {
                errors.push((err as Error).message);
            }
        }
    }

    if (options.groups) {
        for (const groupName of options.groups) {
            const group = await book.getGroup(groupName);
            if (group) {
                account.addGroup(group);
            } else {
                errors.push(`Group not found: ${groupName}`);
            }
        }
    }

    throwIfErrors(errors);

    return account.create();
}
