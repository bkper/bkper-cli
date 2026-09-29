import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { renderList } from '../../render/index.js';
import { transactionsToJson } from './transaction-json.js';

/**
 * Creates multiple transactions from stdin items using the batch API.
 * Outputs all created transactions in an `{"items":[...]}` envelope.
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

    const results = await book.batchCreateTransactions(transactions);
    renderList({ items: await transactionsToJson(results) });
}
