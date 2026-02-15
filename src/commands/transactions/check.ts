import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

/**
 * Marks a transaction as checked (reconciled).
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to check
 * @returns The checked transaction
 */
export async function checkTransaction(
    bookId: string,
    transactionId: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction.check();
}
