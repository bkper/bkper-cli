import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

interface TransactionInput {
    date: string;
    amount: number;
    from_account?: string;
    to_account?: string;
    description: string;
}

interface CreateTransactionsParams {
    bookId: string;
    transactions: TransactionInput[];
}

interface TransactionsResponse {
    transactions: Array<Record<string, any>>;
}

export async function handleCreateTransactions(
    params: CreateTransactionsParams
): Promise<CallToolResult> {
    try {
        // Debug logging removed to prevent stdio contamination

        // Validate required parameters
        if (!params.bookId) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: bookId');
        }

        if (!params.transactions) {
            throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: transactions');
        }

        if (!Array.isArray(params.transactions)) {
            throw new McpError(ErrorCode.InvalidParams, 'Parameter transactions must be an array');
        }

        // Handle empty array case
        if (params.transactions.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ transactions: [] }, null, 2),
                    },
                ],
            };
        }

        // Validate each transaction
        params.transactions.forEach((tx, index) => {
            if (!tx.date || typeof tx.date !== 'string' || tx.date.trim() === '') {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Transaction at index ${index}: Missing or empty required field 'date'`
                );
            }
            if (tx.amount === undefined || tx.amount === null || typeof tx.amount !== 'number') {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Transaction at index ${index}: Missing or invalid required field 'amount'`
                );
            }
            if (
                !tx.description ||
                typeof tx.description !== 'string' ||
                tx.description.trim() === ''
            ) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Transaction at index ${index}: Missing or empty required field 'description'`
                );
            }
        });

        // Get configured Bkper instance
        const bkperInstance = getBkperInstance();

        // Get the book
        const book = await bkperInstance.getBook(params.bookId);
        if (!book) {
            throw new McpError(ErrorCode.InvalidParams, `Book not found: ${params.bookId}`);
        }

        // Create Transaction objects with description built from structured data
        const bkperTransactions = params.transactions.map(tx => {
            const transaction = new Transaction(book);

            // Build description with optional accounts
            const parts: string[] = [];
            if (tx.from_account && tx.from_account.trim()) {
                parts.push(tx.from_account.trim());
            }
            if (tx.to_account && tx.to_account.trim()) {
                parts.push(tx.to_account.trim());
            }
            parts.push(tx.description);

            const fullDescription = parts.join(' ');

            transaction.setDate(tx.date);
            transaction.setAmount(tx.amount);
            transaction.setDescription(fullDescription);

            return transaction;
        });

        // Batch create transactions
        const createdTransactions = await book.batchCreateTransactions(bkperTransactions);

        // Clean response by removing internal fields and ensure JSON serializable
        const transactions = createdTransactions.map((transaction: Transaction) => {
            const transactionJson = transaction.json();

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
            } = transactionJson;

            // Ensure all values are JSON serializable
            return JSON.parse(JSON.stringify(cleanTransaction));
        });

        // Build response
        const response: TransactionsResponse = {
            transactions,
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
        throw new McpError(
            ErrorCode.InternalError,
            `Failed to create transactions: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

export const createTransactionsToolDefinition = {
    name: 'create_transactions',
    description:
        'Create transactions in batch from structured data. Accounts are specified by name and resolved by Bkper.',
    inputSchema: {
        type: 'object',
        properties: {
            bookId: {
                type: 'string',
                description: 'The unique identifier of the book',
            },
            transactions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        date: {
                            type: 'string',
                            description:
                                'Transaction date in ISO format (YYYY-MM-DD) or book date format',
                        },
                        amount: {
                            type: 'number',
                            description: 'Transaction amount',
                        },
                        from_account: {
                            type: 'string',
                            description: 'Origin/Credit account name',
                        },
                        to_account: {
                            type: 'string',
                            description: 'Destination/Debit account name',
                        },
                        description: {
                            type: 'string',
                            description: 'Transaction description (can include #hashtags)',
                        },
                    },
                    required: ['date', 'amount', 'description'],
                },
                description: 'Array of transactions to create',
            },
        },
        required: ['bookId', 'transactions'],
    },
};
