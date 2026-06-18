import { getBkperInstance } from '../../bkper-factory.js';
import { Book, Transaction, Account } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';
import { quoteShellArg } from '../../utils/shell-quote.js';
import { warnIfSuspiciousDateVariableQuery } from '../../utils/query-warning.js';

export const DEFAULT_TRANSACTION_LIST_LIMIT = 100;

function buildTransactionListFooter(
    bookId: string,
    options: ListTransactionsOptions,
    cursor: string | undefined
): string | undefined {
    if (!cursor) {
        return undefined;
    }

    const pageLimit = options.limit ?? DEFAULT_TRANSACTION_LIST_LIMIT;
    const propertiesFlag = options.properties ? ' -p' : '';
    return [
        `Next cursor: ${cursor}`,
        `Next page: bkper transaction list -b ${quoteShellArg(bookId)} -q ${quoteShellArg(
            options.query
        )} --limit ${pageLimit} --cursor ${quoteShellArg(cursor)}${propertiesFlag}`,
    ].join('\n');
}

/**
 * Options for querying transactions from a book.
 */
export interface ListTransactionsOptions {
    query: string;
    properties?: boolean;
    limit?: number;
    cursor?: string;
}

/**
 * Result of a transaction listing query, including the book context.
 */
export interface ListTransactionsResult {
    book: Book;
    items: Transaction[];
    account?: Account;
    cursor?: string;
}

/**
 * Queries transactions from a book, automatically paginating through all
 * results until no more pages remain.
 *
 * Fetches the book with accounts pre-loaded in a single API call, so that
 * account name resolution during table building (getCreditAccountName,
 * getDebitAccountName) resolves from the in-memory cache instead of making
 * individual API calls per transaction.
 *
 * @param bookId - The book ID to query
 * @param options - Query parameters including search string
 * @returns All matching transactions with book context
 */
export async function listTransactions(
    bookId: string,
    options: ListTransactionsOptions
): Promise<ListTransactionsResult> {
    warnIfSuspiciousDateVariableQuery(options.query);

    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId, true);

    const explicitPagination = options.limit !== undefined || options.cursor !== undefined;

    if (explicitPagination) {
        const pageLimit = options.limit ?? DEFAULT_TRANSACTION_LIST_LIMIT;
        const result = await book.listTransactions(options.query, pageLimit, options.cursor);
        const page: ListTransactionsResult = {
            book,
            items: result.getItems() || [],
            account: await result.getAccount(),
        };
        const nextCursor = result.getCursor();
        if (nextCursor) {
            page.cursor = nextCursor;
        }
        return page;
    }

    const allItems: Transaction[] = [];
    let account: Account | undefined;
    let cursor: string | undefined;

    do {
        const result = await book.listTransactions(options.query, undefined, cursor);
        const items = result.getItems();
        if (items && items.length > 0) {
            allItems.push(...items);
        }
        // Capture the account from the first page (it's the same across pages)
        if (account === undefined) {
            account = await result.getAccount();
        }
        const nextCursor = result.getCursor();
        // Stop when no cursor, no items returned, or cursor hasn't changed
        if (!nextCursor || !items || items.length === 0 || nextCursor === cursor) {
            break;
        }
        cursor = nextCursor;
    } while (true);

    return {
        book,
        items: allItems,
        account,
    };
}

/**
 * Lists transactions and returns a ListResult ready for rendering.
 * Absorbs TransactionsDataTableBuilder config and JSON mapping.
 */
export async function listTransactionsFormatted(
    bookId: string,
    options: ListTransactionsOptions,
    format: OutputFormat
): Promise<ListResult> {
    const result = await listTransactions(bookId, options);

    if (format === 'json') {
        const jsonResult: ListResult = {
            kind: 'json',
            items: result.items.map(tx => tx.json()),
        };
        if (result.cursor) {
            jsonResult.cursor = result.cursor;
        }
        return jsonResult;
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
    return {
        kind: 'matrix',
        matrix,
        footer: buildTransactionListFooter(bookId, options, result.cursor),
    };
}
