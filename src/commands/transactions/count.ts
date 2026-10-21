import { getBkperInstance } from '../../bkper-factory.js';
import { warnIfSuspiciousDateVariableQuery } from '../../utils/query-warning.js';

/**
 * Result of a transaction count query.
 */
export interface CountTransactionsResult {
    count: number;
}

/**
 * Counts transactions matching a query using the count endpoint, without
 * fetching the transactions themselves.
 *
 * @param bookId - The book ID to query
 * @param query - Optional search query; counts all transactions when omitted
 * @returns The number of matching transactions
 */
export async function countTransactions(
    bookId: string,
    query?: string
): Promise<CountTransactionsResult> {
    if (query) {
        warnIfSuspiciousDateVariableQuery(query);
    }

    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const total = await book.countTransactions(query);
    return { count: total ?? 0 };
}
