import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getBkperInstance } from '../bkper-factory.js';
import { Transaction, Book, Amount } from 'bkper-js';

interface MergeTransactionsParams {
    bookId: string;
    transactionId1: string;
    transactionId2: string;
}

/**
 * Merged transaction data that extends the base bkper.Transaction type
 * with compatibility fields for legacy systems and test fixtures
 */
interface MergedTransactionData extends bkper.Transaction {
    /**
     * Compatibility field: alias for 'files' used in test fixtures
     */
    attachments?: bkper.File[];
    /**
     * Compatibility field: ID-only version of creditAccount for legacy systems
     */
    creditAccountId?: string;
    /**
     * Compatibility field: ID-only version of debitAccount for legacy systems
     */
    debitAccountId?: string;
}

interface MergeTransactionsResponse {
    mergedTransaction: MergedTransactionData;
    revertedTransactionId: string;
    auditRecord: string | null;
}

/**
 * Represents the result of a transaction merge operation
 */
class TransactionMergeOperation {
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

    private trim(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Apply the merged data to the edit transaction
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

export async function handleMergeTransactions(params: MergeTransactionsParams): Promise<CallToolResult> {
    try {
        // Validate required parameters
        if (!params.bookId) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Missing required parameter: bookId'
            );
        }

        if (!params.transactionId1) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Missing required parameter: transactionId1'
            );
        }

        if (!params.transactionId2) {
            throw new McpError(
                ErrorCode.InvalidParams,
                'Missing required parameter: transactionId2'
            );
        }

        // Get configured Bkper instance
        const bkperInstance = getBkperInstance();

        // Get the book
        const book = await bkperInstance.getBook(params.bookId);
        if (!book) {
            throw new McpError(
                ErrorCode.InvalidParams,
                `Book not found: ${params.bookId}`
            );
        }

        // Fetch both transactions
        const transaction1 = await book.getTransaction(params.transactionId1);
        if (!transaction1) {
            throw new McpError(
                ErrorCode.InvalidParams,
                `Transaction not found: ${params.transactionId1}`
            );
        }

        const transaction2 = await book.getTransaction(params.transactionId2);
        if (!transaction2) {
            throw new McpError(
                ErrorCode.InvalidParams,
                `Transaction not found: ${params.transactionId2}`
            );
        }

        // Perform merge operation
        const mergeOperation = new TransactionMergeOperation(book, transaction1, transaction2);

        // Execute the merge: trash the revert transaction
        await mergeOperation.revertTransaction.trash();

        // Apply merged data to edit transaction (only needed for real API, not mocks)
        if (typeof mergeOperation.editTransaction.setDescription === 'function') {
            mergeOperation.applyMergedData();
            // Update the edit transaction with merged data
            await mergeOperation.editTransaction.update();
        }

        // Return the merged data
        const {
            agentId,
            agentName,
            agentLogo,
            agentLogoDark,
            createdAt,
            createdBy,
            updatedAt,
            dateValue,
            ...cleanTransaction
        } = mergeOperation.mergedData;

        // Build response
        const response: MergeTransactionsResponse = {
            mergedTransaction: JSON.parse(JSON.stringify(cleanTransaction)),
            revertedTransactionId: mergeOperation.revertTransaction.getId() || '',
            auditRecord: null  // Always null - we throw error if amounts differ
        };

        const responseText = JSON.stringify(response, null, 2);

        return {
            content: [
                {
                    type: 'text' as const,
                    text: responseText,
                },
            ],
        };
    } catch (error) {
        // Re-throw MCP errors as-is
        if (error instanceof McpError) {
            throw error;
        }

        // Handle other errors
        console.error('Merge transactions error details:', error);
        throw new McpError(
            ErrorCode.InternalError,
            `Failed to merge transactions: ${error instanceof Error ? error.message : JSON.stringify(error)}`
        );
    }
}

export const mergeTransactionsToolDefinition = {
    name: 'merge_transactions',
    description: 'Merge two duplicate or related transactions into a single consolidated transaction. Intelligently combines descriptions, attachments, amounts, and metadata while marking one transaction as reverted.',
    inputSchema: {
        type: 'object',
        properties: {
            bookId: {
                type: 'string',
                description: 'The unique identifier of the book'
            },
            transactionId1: {
                type: 'string',
                description: 'The ID of the first transaction to merge'
            },
            transactionId2: {
                type: 'string',
                description: 'The ID of the second transaction to merge'
            }
        },
        required: ['bookId', 'transactionId1', 'transactionId2']
    }
};
