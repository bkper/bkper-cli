import { getBkperInstance } from '../../bkper-factory.js';
import { Account, Book } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

/**
 * Creates multiple accounts from stdin items using the batch API.
 * Outputs a flat JSON array of all created accounts.
 *
 * Stdin items must follow the bkper.Account format exactly.
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items as bkper.Account payloads
 * @param propertyOverrides - CLI --property flags that override stdin properties
 */
export async function batchCreateAccounts(
    bookId: string,
    items: Record<string, unknown>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const accounts: Account[] = [];

    for (const item of items) {
        const account = await buildAccountFromStdin(book, item);

        // CLI --property flags override stdin properties
        if (propertyOverrides) {
            for (const raw of propertyOverrides) {
                const [key, value] = parsePropertyFlag(raw);
                if (value === '') {
                    account.deleteProperty(key);
                } else {
                    account.setProperty(key, value);
                }
            }
        }

        accounts.push(account);
    }

    const results = await book.batchCreateAccounts(accounts);
    const allResults = results.map(result => result.json());

    console.log(JSON.stringify(allResults, null, 2));
}

async function buildAccountFromStdin(book: Book, item: Record<string, unknown>): Promise<Account> {
    const payload: bkper.Account = {...(item as bkper.Account)};
    const groupRefs = payload.groups;
    delete payload.groups;

    const account = new Account(book, payload);

    if (groupRefs) {
        for (const groupRef of groupRefs) {
            const idOrName = groupRef.id || groupRef.name;
            if (!idOrName || idOrName.trim() === '') {
                throw new Error('Account group reference must include id or name');
            }

            const group = await book.getGroup(idOrName);
            if (!group) {
                throw new Error(`Group not found: ${idOrName}`);
            }

            account.addGroup(group);
        }
    }

    return account;
}
