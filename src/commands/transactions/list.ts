import { getBkperInstance } from '../../bkper-factory.js';
import { Book, Transaction, Account, TransactionList } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';

/**
 * Options for querying transactions from a book.
 */
export interface ListTransactionsOptions {
    query: string;
    limit?: number;
    cursor?: string;
    properties?: boolean;
}

/**
 * Result of a transaction listing query, including the book context and pagination cursor.
 */
export interface ListTransactionsResult {
    book: Book;
    items: Transaction[];
    account?: Account;
    cursor?: string;
}

/**
 * Queries transactions from a book using the provided search options.
 *
 * @param bookId - The book ID to query
 * @param options - Query parameters including search string, limit, and cursor
 * @returns The matching transactions with book context and pagination cursor
 */
export async function listTransactions(
    bookId: string,
    options: ListTransactionsOptions
): Promise<ListTransactionsResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const result = await book.listTransactions(options.query, options.limit, options.cursor);
    const items = result.getItems();
    const account = await result.getAccount();
    return {
        book,
        items: items || [],
        account,
        cursor: result.getCursor(),
    };
}

/**
 * Lists transactions and returns a ListResult ready for rendering.
 * Absorbs TransactionsDataTableBuilder config, JSON wrapping, and cursor footer.
 */
export async function listTransactionsFormatted(
    bookId: string,
    options: ListTransactionsOptions,
    format: OutputFormat
): Promise<ListResult> {
    const result = await listTransactions(bookId, options);

    if (format === 'json') {
        return {
            kind: 'json',
            data: {
                items: result.items.map(tx => tx.json()),
                cursor: result.cursor,
            },
        };
    }

    const builder = result.book.createTransactionsDataTable(result.items, result.account).ids(true);

    if (format === 'csv') {
        builder.properties(true).hiddenProperties(true).urls(true).recordedAt(true);
    } else {
        builder.formatDates(true).formatValues(true).recordedAt(false);
        if (options.properties) {
            builder.properties(true);
        }
    }

    const matrix = await builder.build();
    const footer = result.cursor ? `\nNext cursor: ${result.cursor}` : undefined;
    return { kind: 'matrix', matrix, footer };
}
