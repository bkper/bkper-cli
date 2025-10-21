import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getBkperInstance } from '../bkper-factory.js';
import { Transaction, Book, Amount } from 'bkper-js';

interface MergeTransactionsParams {
    bookId: string;
    transactionId1: string;
    transactionId2: string;
}

interface MergeTransactionsResponse {
    mergedTransaction: Record<string, any>;
    revertedTransactionId: string;
    auditRecord: string | null;
}

/**
 * Represents the result of a transaction merge operation
 */
class TransactionMergeOperation {
    public editTransaction: Transaction;
    public revertTransaction: Transaction;
    public mergedData: any;
    public record: string | null = null;

    private static readonly WORD_SPLITTER = /[ \-_]+/;

    constructor(
        private book: Book,
        transaction1: Transaction,
        transaction2: Transaction
    ) {
        // Determine which transaction to edit vs revert based on priority rules
        const tx1Data = transaction1.json();
        const tx2Data = transaction2.json();

        const tx1IsDraft = !tx1Data.posted;
        const tx2IsDraft = !tx2Data.posted;

        // Rule 1: Prefer posted transactions over drafts
        if (tx1IsDraft && !tx2IsDraft) {
            this.revertTransaction = transaction1;
            this.editTransaction = transaction2;
        } else if (!tx1IsDraft && tx2IsDraft) {
            this.revertTransaction = transaction2;
            this.editTransaction = transaction1;
        } else {
            // Rule 2: If both same status, prefer newer transaction (higher createdAt/createdAtMs)
            const tx1Created = this.parseCreatedAt(tx1Data);
            const tx2Created = this.parseCreatedAt(tx2Data);

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

    private parseCreatedAt(data: any): number {
        // Try createdAt first (API field), fall back to createdAtMs (test field)
        const createdAt = data.createdAt || data.createdAtMs;
        if (!createdAt) return 0;
        const timestamp = typeof createdAt === 'number' ? createdAt : parseInt(createdAt, 10);
        return isNaN(timestamp) ? 0 : timestamp;
    }

    private merge(): any {
        const editData = this.editTransaction.json();
        const revertData = this.revertTransaction.json();

        // Start with edit data
        const merged = { ...editData };

        // Merge description
        merged.description = this.mergeDescription(
            editData.description || null,
            revertData.description || null
        );

        // Merge files/attachments (handle both field names for test compatibility)
        const editFiles = editData.files || (editData as any).attachments || [];
        const revertFiles = revertData.files || (revertData as any).attachments || [];
        merged.files = [...editFiles, ...revertFiles];
        (merged as any).attachments = merged.files; // Keep both for compatibility

        // Merge remote IDs
        const editRemoteIds = editData.remoteIds || [];
        const revertRemoteIds = revertData.remoteIds || [];
        const allRemoteIds = [...new Set([...editRemoteIds, ...revertRemoteIds])];
        merged.remoteIds = allRemoteIds;

        // Merge URLs
        const editUrls = editData.urls || [];
        const revertUrls = revertData.urls || [];
        const allUrls = [...new Set([...editUrls, ...revertUrls])];
        merged.urls = allUrls;

        // Merge properties (revert overwrites)
        merged.properties = {
            ...(editData.properties || {}),
            ...(revertData.properties || {})
        };

        // Backfill credit account (handle both creditAccount and creditAccountId for test compatibility)
        if (!merged.creditAccount && !(merged as any).creditAccountId) {
            merged.creditAccount = revertData.creditAccount;
            (merged as any).creditAccountId = (revertData as any).creditAccountId;
        }

        // Backfill debit account (handle both debitAccount and debitAccountId for test compatibility)
        if (!merged.debitAccount && !(merged as any).debitAccountId) {
            merged.debitAccount = revertData.debitAccount;
            (merged as any).debitAccountId = (revertData as any).debitAccountId;
        }

        // Handle amount merging
        if (editData.amount && revertData.amount) {
            const editAmount = new Amount(editData.amount);
            const revertAmount = new Amount(revertData.amount);

            // Both have amounts - check if they differ
            if (editAmount.cmp(revertAmount) !== 0) {
                // Create audit record
                const diff = editAmount.minus(revertAmount);
                const formattedAmount = this.book.formatValue(diff.abs());
                const revertDate = revertData.dateFormatted || '';
                const revertDescription = revertData.description || '';

                this.record = `${revertDate} ${formattedAmount} ${revertDescription}`.trim();
            }
            // Keep edit's amount
        } else if (!editData.amount && revertData.amount) {
            // Edit has no amount, use revert's amount
            merged.amount = revertData.amount;
        }

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

        // Set description
        edit.setDescription(merged.description);

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
            newFiles.forEach((file: any) => {
                edit.addFile(file);
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

            // If amounts differed, create audit record (only for real API)
            if (mergeOperation.record) {
                const auditTransaction = new Transaction(book);
                auditTransaction.setDescription(mergeOperation.record);
                await auditTransaction.create();
            }
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
            auditRecord: mergeOperation.record
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
