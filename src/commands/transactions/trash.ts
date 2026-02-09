import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

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
