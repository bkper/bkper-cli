import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { TransactionMergeOperation } from '../../domain/transaction/merge-operation.js';
import { throwIfErrors } from '../../utils/validation.js';

export interface MergeResult {
    mergedTransaction: Transaction;
    revertedTransactionId: string;
    auditRecord: string | null;
}

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
