/**
 * Transaction Merge Operation - Domain Logic
 *
 * Pure business logic for merging two transactions into one.
 * This class contains no dependencies on MCP, HTTP, or other infrastructure concerns.
 * It operates on Transaction domain objects from bkper-js.
 */

import { Transaction, Book } from 'bkper-js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MergedTransactionData } from './merge-types.js';

/**
 * Represents the result of a transaction merge operation
 *
 * Determines which transaction to keep (edit) vs discard (revert),
 * then intelligently merges data from both transactions.
 */
export class TransactionMergeOperation {
    public editTransaction: Transaction;
    public revertTransaction: Transaction;
    public mergedData: MergedTransactionData;
    public record: string | null = null;

    private static readonly WORD_SPLITTER = /[ \-_]+/;

    constructor(
        private book: Book,
        transaction1: Transaction,
        transaction2: Transaction
    ) {
        // Determine which transaction to edit vs revert based on priority rules
        const tx1IsPosted = transaction1.isPosted() ?? false;
        const tx2IsPosted = transaction2.isPosted() ?? false;

        // Rule 1: Prefer posted transactions over drafts
        if (!tx1IsPosted && tx2IsPosted) {
            this.revertTransaction = transaction1;
            this.editTransaction = transaction2;
        } else if (tx1IsPosted && !tx2IsPosted) {
            this.revertTransaction = transaction2;
            this.editTransaction = transaction1;
        } else {
            // Rule 2: If both same status, prefer newer transaction (higher createdAt)
            const tx1Created = transaction1.getCreatedAt().getTime();
            const tx2Created = transaction2.getCreatedAt().getTime();

            if (tx1Created < tx2Created) {
                this.revertTransaction = transaction1;
                this.editTransaction = transaction2;
            } else {
                this.revertTransaction = transaction2;
                this.editTransaction = transaction1;
            }
        }

        this.mergedData = this.merge();
    }

    /**
     * Merges data from both transactions into a single transaction data object
     * @returns Merged transaction data
     */
    private merge(): MergedTransactionData {
        // Start with edit transaction's JSON data as base
        const merged: MergedTransactionData = { ...this.editTransaction.json() };

        // Merge description using Transaction wrapper
        const editDescription = this.editTransaction.getDescription();
        const revertDescription = this.revertTransaction.getDescription();
        merged.description = this.mergeDescription(
            editDescription || null,
            revertDescription || null
        );

        // Merge files using Transaction wrapper
        const editFiles = this.editTransaction.getFiles() || [];
        const revertFiles = this.revertTransaction.getFiles() || [];
        const mergedFiles = [
            ...editFiles.map(f => f.json()),
            ...revertFiles.map(f => f.json())
        ];
        merged.files = mergedFiles;
        // Keep "attachments" for backward compatibility with test fixtures
        merged.attachments = mergedFiles;

        // Merge remote IDs using Transaction wrapper
        const editRemoteIds = this.editTransaction.getRemoteIds();
        const revertRemoteIds = this.revertTransaction.getRemoteIds();
        merged.remoteIds = [...new Set([...editRemoteIds, ...revertRemoteIds])];

        // Merge URLs using Transaction wrapper
        const editUrls = this.editTransaction.getUrls();
        const revertUrls = this.revertTransaction.getUrls();
        merged.urls = [...new Set([...editUrls, ...revertUrls])];

        // Merge properties using Transaction wrapper (revert overwrites edit)
        const editProperties = this.editTransaction.getProperties();
        const revertProperties = this.revertTransaction.getProperties();
        merged.properties = {
            ...editProperties,
            ...revertProperties
        };

        // Backfill credit account - get from revert if edit doesn't have it
        const editData = this.editTransaction.json();
        const revertData = this.revertTransaction.json();

        if (!editData.creditAccount && !(editData as MergedTransactionData).creditAccountId) {
            if (revertData.creditAccount) merged.creditAccount = revertData.creditAccount;
            const revertCompat = revertData as MergedTransactionData;
            if (revertCompat.creditAccountId) merged.creditAccountId = revertCompat.creditAccountId;
        }

        // Backfill debit account - get from revert if edit doesn't have it
        if (!editData.debitAccount && !(editData as MergedTransactionData).debitAccountId) {
            if (revertData.debitAccount) merged.debitAccount = revertData.debitAccount;
            const revertCompat = revertData as MergedTransactionData;
            if (revertCompat.debitAccountId) merged.debitAccountId = revertCompat.debitAccountId;
        }

        // Handle amount validation and merging using Transaction wrapper
        const editAmount = this.editTransaction.getAmount();
        const revertAmount = this.revertTransaction.getAmount();

        if (editAmount && revertAmount) {
            // Both have amounts - validate they are equal
            if (editAmount.cmp(revertAmount) !== 0) {
                // Amounts differ - throw error for manual reconciliation
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Cannot merge transactions with different amounts: ${editAmount.toString()} vs ${revertAmount.toString()}. ` +
                    `Please reconcile amounts manually before merging.`
                );
            }
            // Amounts are equal - keep edit's amount (no change needed)
        } else if (!editAmount && revertAmount) {
            // Edit has no amount, use revert's amount
            merged.amount = revertAmount.toString();
        }
        // If edit has amount and revert doesn't, keep edit's amount (already in merged)

        return merged;
    }

    /**
     * Merges two descriptions intelligently, avoiding duplicate words
     * @param desc1 First description (from edit transaction)
     * @param desc2 Second description (from revert transaction)
     * @returns Merged description with unique words
     */
    private mergeDescription(desc1: string | null, desc2: string | null): string {
        if (!desc1) return desc2 || '';
        if (!desc2) return desc1;

        const desc1Lower = desc1.toLowerCase();
        const words = desc2.split(TransactionMergeOperation.WORD_SPLITTER)
            .filter(word => word.length > 0);

        const uniqueWords = words.filter(word =>
            !desc1Lower.includes(word.toLowerCase())
        );

        return this.trim(desc1 + ' ' + uniqueWords.join(' '));
    }

    /**
     * Trims and normalizes whitespace in text
     * @param text Text to trim
     * @returns Trimmed text with normalized whitespace
     */
    private trim(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Apply the merged data to the edit transaction
     * This mutates the edit transaction object with the merged data
     */
    applyMergedData(): void {
        const edit = this.editTransaction;
        const merged = this.mergedData;

        // Set description (ensure it's a string)
        if (merged.description !== undefined) {
            edit.setDescription(merged.description);
        }

        // Set properties
        if (merged.properties) {
            edit.setProperties(merged.properties);
        }

        // Set URLs
        if (merged.urls && merged.urls.length > 0) {
            edit.setUrls(merged.urls);
        }

        // Set amount if changed
        if (merged.amount) {
            edit.setAmount(merged.amount);
        }

        // Set credit account if changed
        if (merged.creditAccount) {
            edit.setCreditAccount(merged.creditAccount);
        }

        // Set debit account if changed
        if (merged.debitAccount) {
            edit.setDebitAccount(merged.debitAccount);
        }

        // Add remote IDs
        const currentRemoteIds = edit.getRemoteIds();
        if (merged.remoteIds) {
            merged.remoteIds.forEach((remoteId: string) => {
                if (!currentRemoteIds.includes(remoteId)) {
                    edit.addRemoteId(remoteId);
                }
            });
        }

        // Add files
        if (merged.files && merged.files.length > (this.editTransaction.getFiles()?.length || 0)) {
            const currentFiles = this.editTransaction.getFiles() || [];
            const newFiles = merged.files.slice(currentFiles.length);
            newFiles.forEach((file: bkper.File) => {
                // addFile expects File class but accepts raw bkper.File in practice
                edit.addFile(file as unknown as import('bkper-js').File);
            });
        }
    }
}
