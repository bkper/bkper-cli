import { Transaction } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Retrieves a single transaction by ID from the specified book.
 *
 * @param bookId - The target book ID
 * @param transactionId - Transaction ID to look up
 * @returns The matching transaction
 * @throws Error if the transaction is not found
 */
export async function getTransaction(
    bookId: string,
    transactionId: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction;
}
