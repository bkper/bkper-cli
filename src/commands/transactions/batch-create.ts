import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

const CHUNK_SIZE = 100;

/**
 * Creates multiple transactions from stdin items using the batch API.
 * Outputs a flat JSON array of all created transactions.
 *
 * Stdin items must follow the bkper.Transaction format exactly.
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items as bkper.Transaction payloads
 * @param propertyOverrides - CLI --property flags that override stdin properties
 */
export async function batchCreateTransactions(
    bookId: string,
    items: Record<string, unknown>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const allResults: bkper.Transaction[] = [];

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const transactions: Transaction[] = [];

        for (const item of chunk) {
            const tx = new Transaction(book, item as bkper.Transaction);

            // CLI --property flags override stdin properties
            if (propertyOverrides) {
                for (const raw of propertyOverrides) {
                    const [key, value] = parsePropertyFlag(raw);
                    if (value === '') {
                        tx.deleteProperty(key);
                    } else {
                        tx.setProperty(key, value);
                    }
                }
            }

            transactions.push(tx);
        }

        const results = await book.batchCreateTransactions(transactions);
        for (const result of results) {
            allResults.push(result.json());
        }
    }

    console.log(JSON.stringify(allResults, null, 2));
}
