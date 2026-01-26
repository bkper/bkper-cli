import { CallToolResult, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getBkperInstance } from "../../bkper-factory.js";

interface ListTransactionsParams {
    bookId: string;
    cursor?: string;
    query: string;
    limit?: number;
}

interface TransactionsResponse {
    transactions: Array<any>;
    hasMore: boolean;
    cursor: string | null;
    limit: number;
    query?: string;
}

export async function handleListTransactions(
    params: ListTransactionsParams
): Promise<CallToolResult> {
    try {
        // Validate required parameters
        if (!params.bookId) {
            throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: bookId");
        }

        if (!params.query) {
            throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: query");
        }

        // Get configured Bkper instance
        const bkperInstance = getBkperInstance();

        // Get the book first
        const book = await bkperInstance.getBook(params.bookId);
        if (!book) {
            throw new McpError(ErrorCode.InvalidParams, `Book not found: ${params.bookId}`);
        }

        // Set up pagination parameters
        const limit = Math.min(params.limit || 25, 100); // Default 25, max 100

        // Get transactions using native API pagination
        const transactionList = await book.listTransactions(params.query, limit, params.cursor);

        // Get transactions from list
        const transactionItems = transactionList.getItems();
        const transactions = transactionItems.map((transaction: any) => {
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
            } = transaction.json();
            return cleanTransaction;
        });

        // Get pagination info from list
        const hasMore = transactionItems.length > 0;
        const nextCursor = transactionList.getCursor() || null;

        // Build response
        const response: TransactionsResponse = {
            transactions,
            hasMore,
            cursor: nextCursor,
            limit,
        };

        // Include query in response (now always provided)
        response.query = params.query;

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2),
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
            `Failed to list transactions: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export const listTransactionsToolDefinition = {
    name: "list_transactions",
    description:
        "List transactions with native API cursor-based pagination and query filtering. Use get_book first to understand query syntax and usage rules.",
    inputSchema: {
        type: "object",
        properties: {
            bookId: {
                type: "string",
                description: "The unique identifier of the book",
            },
            cursor: {
                type: "string",
                description: "Pagination cursor for next page (provided by previous response)",
            },
            query: {
                type: "string",
                description:
                    "Required query string to filter transactions using comprehensive syntax (account:, from:, to:, group:, on:, after:, before:, amount:, text search, logical operators, etc.)",
            },
            limit: {
                type: "number",
                description: "Number of transactions per page (default: 25, maximum: 100)",
                minimum: 1,
                maximum: 100,
            },
        },
        required: ["bookId", "query"],
    },
};
