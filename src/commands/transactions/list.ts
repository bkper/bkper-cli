import { getBkperInstance } from '../../bkper-factory.js';
import { Book, Transaction, Account } from 'bkper-js';
import type { ListResult } from '../../render/output.js';
import { transactionsToJson } from './transaction-json.js';
import { quoteShellArg } from '../../utils/shell-quote.js';
import { warnIfSuspiciousDateVariableQuery } from '../../utils/query-warning.js';

export const DEFAULT_TRANSACTION_LIST_LIMIT = 100;

function buildTransactionListHint(
    bookId: string,
    options: ListTransactionsOptions,
    cursor: string | undefined
): string | undefined {
    if (!cursor) {
        return undefined;
    }

    const pageLimit = options.limit ?? DEFAULT_TRANSACTION_LIST_LIMIT;
    return [
        `Next cursor: ${cursor}`,
        `Next page: bkper transaction list -b ${quoteShellArg(bookId)} -q ${quoteShellArg(
            options.query
        )} --limit ${pageLimit} --cursor ${quoteShellArg(cursor)}`,
    ].join('\n');
}

/**
 * Options for querying transactions from a book.
 */
export interface ListTransactionsOptions {
    query: string;
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
 * account name resolution during serialization resolves from the in-memory
 * cache instead of making individual API calls per transaction.
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
 */
export async function listTransactionsFormatted(
    bookId: string,
    options: ListTransactionsOptions
): Promise<ListResult> {
    const result = await listTransactions(bookId, options);

    const listResult: ListResult = {
        items: await transactionsToJson(result.items),
    };
    if (result.cursor) {
        listResult.cursor = result.cursor;
    }
    const hint = buildTransactionListHint(bookId, options, result.cursor);
    if (hint) {
        listResult.hint = hint;
    }
    return listResult;
}
