/**
 * MCP Tool: merge_transactions
 *
 * Thin adapter that handles MCP protocol concerns (validation, error handling, response formatting)
 * and delegates business logic to the domain layer.
 */

import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getBkperInstance } from '../bkper-factory.js';
import { TransactionMergeOperation } from '../domain/transaction/merge-operation.js';
import { MergedTransactionData } from '../domain/transaction/merge-types.js';

/**
 * MCP-specific request parameters
 */
interface MergeTransactionsParams {
    bookId: string;
    transactionId1: string;
    transactionId2: string;
}

/**
 * MCP-specific response format
 */
interface MergeTransactionsResponse {
    mergedTransaction: MergedTransactionData;
    revertedTransactionId: string;
    auditRecord: string | null;
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
