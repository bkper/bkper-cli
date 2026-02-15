import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountType } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { throwIfErrors } from '../../utils/validation.js';

/**
 * Options for updating an existing account.
 *
 * @property name - New account name
 * @property type - New account type classification
 * @property archived - Whether to archive or unarchive the account
 * @property property - Custom properties in "key=value" format; empty value deletes the property
 */
export interface UpdateAccountOptions {
    name?: string;
    type?: 'ASSET' | 'LIABILITY' | 'INCOMING' | 'OUTGOING';
    archived?: boolean;
    property?: string[];
}

/**
 * Updates an existing account in the specified book.
 * Applies only the provided options, leaving other fields unchanged.
 *
 * @param bookId - The target book ID
 * @param accountIdOrName - Account ID or name to update
 * @param options - Fields to update on the account
 * @returns The updated account
 * @throws Error if the account is not found
 */
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

    const errors: string[] = [];

    if (options.name !== undefined) account.setName(options.name);
    if (options.type !== undefined) account.setType(options.type as AccountType);
    if (options.archived !== undefined) account.setArchived(options.archived);

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

    throwIfErrors(errors);

    return account.update();
}
