import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

/**
 * Moves a transaction to the trash.
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to trash
 * @returns The trashed transaction
 */
export async function trashTransaction(
    bookId: string,
    transactionId: string
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction.trash();
}
