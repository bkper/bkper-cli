import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

/**
 * Restores a transaction from the trash.
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to restore
 * @returns The restored transaction
 */
export async function untrashTransaction(
    bookId: string,
    transactionId: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction.untrash();
}
