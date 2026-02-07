import { getBkperInstance } from '../../bkper-factory.js';

export async function trashTransaction(
    bookId: string,
    transactionId: string
): Promise<bkper.Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);
    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }
    const trashed = await transaction.trash();
    return trashed.json();
}
