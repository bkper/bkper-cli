import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

/**
 * Posts a draft transaction, making it permanent in the book.
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to post
 * @returns The posted transaction
 */
export async function postTransaction(bookId: string, transactionId: string): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction.post();
}
