import { getBkperInstance } from '../../bkper-factory.js';
import { Account } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

const CHUNK_SIZE = 100;

/**
 * Creates multiple accounts from stdin items using the batch API.
 * Outputs NDJSON (one JSON object per line) as each chunk completes.
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

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const accounts: Account[] = [];

        for (const item of chunk) {
            const account = new Account(book, item as bkper.Account);

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
        for (const result of results) {
            console.log(JSON.stringify(result.json()));
        }
    }
}
