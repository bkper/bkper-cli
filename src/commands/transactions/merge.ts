import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { TransactionMergeOperation } from '../../domain/transaction/merge-operation.js';
import { throwIfErrors } from '../../utils/validation.js';

/**
 * Result of merging two transactions.
 */
export interface MergeResult {
    mergedTransaction: Transaction;
    revertedTransactionId: string;
    auditRecord: string | null;
}

/**
 * Merges two transactions by updating one and trashing the other.
 * Fails if the transaction amounts differ.
 *
 * @param bookId - The book ID containing both transactions
 * @param transactionId1 - The ID of the first transaction
 * @param transactionId2 - The ID of the second transaction
 * @returns The merge result with the updated transaction and reverted ID
 */
export async function mergeTransactions(
    bookId: string,
    transactionId1: string,
    transactionId2: string
): Promise<MergeResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const [tx1, tx2] = await Promise.all([
        book.getTransaction(transactionId1),
        book.getTransaction(transactionId2),
    ]);

    const errors: string[] = [];
    if (!tx1) {
        errors.push(`Transaction not found: ${transactionId1}`);
    }
    if (!tx2) {
        errors.push(`Transaction not found: ${transactionId2}`);
    }
    throwIfErrors(errors);

    // After validation, tx1 and tx2 are guaranteed to be defined
    const mergeOp = new TransactionMergeOperation(book, tx1!, tx2!);

    if (mergeOp.record) {
        throw new Error(`Cannot merge: amounts differ. ${mergeOp.record}`);
    }

    // Apply merged data to the edit transaction
    mergeOp.applyMergedData();

    // Update the edit transaction and trash the revert transaction
    const [updated] = await Promise.all([
        mergeOp.editTransaction.update(),
        mergeOp.revertTransaction.trash(),
    ]);

    return {
        mergedTransaction: updated,
        revertedTransactionId: mergeOp.revertTransaction.getId() || '',
        auditRecord: mergeOp.record,
    };
}
