import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import type { StdinValue } from '../../input/index.js';

const CHUNK_SIZE = 100;

/**
 * Resolves a StdinValue that may be a string[] or comma-separated string into a string array.
 */
function resolveArray(value: StdinValue): string[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }
    return [];
}

/**
 * Creates multiple transactions from stdin items using the batch API.
 * Outputs NDJSON (one JSON object per line) as each chunk completes.
 *
 * Stdin field names follow the Bkper API format:
 *   date, amount, description, creditAccount, debitAccount, urls, remoteIds
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items (field-value maps)
 * @param propertyOverrides - CLI --property flags that override stdin fields
 */
export async function batchCreateTransactions(
    bookId: string,
    items: Record<string, StdinValue>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const transactions: Transaction[] = [];

        for (const item of chunk) {
            const tx = new Transaction(book);
            if (item.date) tx.setDate(String(item.date));
            if (item.amount) tx.setAmount(String(item.amount));
            if (item.description) tx.setDescription(String(item.description));

            if (item.creditAccount) {
                const creditAccount = await book.getAccount(String(item.creditAccount));
                if (creditAccount) tx.setCreditAccount(creditAccount);
            }
            if (item.debitAccount) {
                const debitAccount = await book.getAccount(String(item.debitAccount));
                if (debitAccount) tx.setDebitAccount(debitAccount);
            }

            if (item.urls) {
                for (const u of resolveArray(item.urls)) {
                    tx.addUrl(u);
                }
            }

            if (item.remoteIds) {
                for (const r of resolveArray(item.remoteIds)) {
                    tx.addRemoteId(r);
                }
            }

            // Set properties from stdin fields (excluding known fields)
            const knownFields = new Set([
                'date',
                'amount',
                'description',
                'creditAccount',
                'debitAccount',
                'urls',
                'remoteIds',
            ]);
            for (const [key, value] of Object.entries(item)) {
                if (!knownFields.has(key) && value !== '') {
                    tx.setProperty(key, String(value));
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
