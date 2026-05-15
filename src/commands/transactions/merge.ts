import { Transaction } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Merges two transactions using the canonical server-side merge operation.
 *
 * The returned transaction is the new merged transaction created synchronously
 * by the backend. Cleanup of the two original transactions happens
 * asynchronously on the server.
 *
 * @param bookId - The book ID containing both transactions
 * @param transactionId1 - The ID of the first transaction
 * @param transactionId2 - The ID of the second transaction
 * @returns The canonical merged transaction
 */
export async function mergeTransactions(
    bookId: string,
    transactionId1: string,
    transactionId2: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    return book.mergeTransactions(transactionId1, transactionId2);
}
