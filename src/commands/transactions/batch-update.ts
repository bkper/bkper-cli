import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

/**
 * Updates multiple transactions from stdin items using the batch API.
 * Outputs a flat JSON array of all updated transactions.
 *
 * Each stdin item must have an `id` field identifying the transaction to update.
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items as bkper.Transaction payloads (must include id)
 * @param propertyOverrides - CLI --property flags that override stdin properties
 * @param updateChecked - Whether to also update checked transactions
 */
export async function batchUpdateTransactions(
    bookId: string,
    items: Record<string, unknown>[],
    propertyOverrides?: string[],
    updateChecked?: boolean
): Promise<void> {
    const missing = items.map((item, idx) => (item.id ? null : idx)).filter(idx => idx !== null);
    if (missing.length > 0) {
        const positions = missing.map(idx => `item[${idx}]`).join(', ');
        throw new Error(`Missing required "id" field on: ${positions}`);
    }

    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const transactions: Transaction[] = [];

    for (const item of items) {
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

    const results = await book.batchUpdateTransactions(transactions, updateChecked);
    const allResults = results.map(result => result.json());

    console.log(JSON.stringify(allResults, null, 2));
}
