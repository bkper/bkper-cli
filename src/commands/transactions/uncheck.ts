import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

/**
 * Marks a checked transaction as unchecked (editable).
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to uncheck
 * @returns The unchecked transaction
 */
export async function uncheckTransaction(
    bookId: string,
    transactionId: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction.uncheck();
}
