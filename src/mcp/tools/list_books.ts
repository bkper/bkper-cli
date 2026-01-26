import { CallToolResult, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getBkperInstance } from "../../bkper-factory.js";

interface ListBooksParams {
    filter: string;
}

interface BooksResponse {
    total: number;
    books: Array<any>; // Full bkper.Book JSON objects
}

async function fetchBooks(filter: string): Promise<{ books: Array<any>; total: number }> {
    // Get configured Bkper instance
    const bkperInstance = getBkperInstance();

    // Get books using high-level wrapper with required filter
    const bkperBooks = await bkperInstance.getBooks(filter);

    // Return full book JSON data - no filtering, no transforming
    const books = bkperBooks.map((book: any) => book.json());

    const total = books.length;

    return { books, total };
}

export async function handleListBooks(params: ListBooksParams): Promise<CallToolResult> {
    try {
        // Fetch all books with required filter
        const { books, total } = await fetchBooks(params.filter);

        // Build response
        const response: BooksResponse = {
            total,
            books,
        };

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
            `Failed to list books: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export const listBooksToolDefinition = {
    name: "list_books",
    description: "List books with mandatory filtering by name or property",
    inputSchema: {
        type: "object",
        properties: {
            filter: {
                type: "string",
                description:
                    "Required filter to search books by name or property (case-insensitive substring match)",
            },
        },
        required: ["filter"],
    },
};

