import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

const CHUNK_SIZE = 100;

/**
 * Creates multiple transactions from stdin items using the batch API.
 * Outputs NDJSON (one JSON object per line) as each chunk completes.
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items (field-value maps)
 * @param propertyOverrides - CLI --property flags that override stdin fields
 */
export async function batchCreateTransactions(
    bookId: string,
    items: Record<string, string>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const transactions: Transaction[] = [];

        for (const item of chunk) {
            const tx = new Transaction(book);
            if (item.date) tx.setDate(item.date);
            if (item.amount) tx.setAmount(item.amount);
            if (item.description) tx.setDescription(item.description);

            if (item.from) {
                const creditAccount = await book.getAccount(item.from);
                if (creditAccount) tx.setCreditAccount(creditAccount);
            }
            if (item.to) {
                const debitAccount = await book.getAccount(item.to);
                if (debitAccount) tx.setDebitAccount(debitAccount);
            }

            if (item.url) {
                for (const u of item.url.split(',').map((s: string) => s.trim())) {
                    if (u) tx.addUrl(u);
                }
            }

            if (item.remoteId || item['remote-id'] || item['Remote Id']) {
                const rid = item.remoteId || item['remote-id'] || item['Remote Id'];
                for (const r of rid.split(',').map((s: string) => s.trim())) {
                    if (r) tx.addRemoteId(r);
                }
            }

            // Set properties from stdin fields (excluding known fields)
            const knownFields = new Set([
                'date',
                'amount',
                'description',
                'from',
                'to',
                'url',
                'remoteId',
                'remote-id',
                'Remote Id',
            ]);
            for (const [key, value] of Object.entries(item)) {
                if (!knownFields.has(key) && value !== '') {
                    tx.setProperty(key, value);
                }
            }

            // CLI --property flags override stdin
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
            console.log(JSON.stringify(result.json()));
        }
    }
}
