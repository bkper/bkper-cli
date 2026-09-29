import { Event, EventType, type ListEventsOptions } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { ListResult } from '../../render/output.js';
import { quoteShellArg } from '../../utils/shell-quote.js';

export const DEFAULT_EVENT_LIST_LIMIT = 50;

/**
 * Options for listing events from a book.
 */
export interface ListBookEventsOptions {
    afterDate?: string;
    beforeDate?: string;
    resourceId?: string;
    onError?: boolean;
    type?: EventType;
    limit?: number;
    cursor?: string;
}

/**
 * Result of an event listing query.
 */
export interface ListBookEventsResult {
    items: Event[];
    cursor?: string;
}

/**
 * Lists one page of events from a book.
 *
 * @param bookId - The book ID to query
 * @param options - Filter and pagination options
 * @returns Event page items and optional next cursor
 */
export async function listEvents(
    bookId: string,
    options: ListBookEventsOptions = {}
): Promise<ListBookEventsResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const listOptions = toListEventsOptions(options);
    const result = await book.listEvents(listOptions);

    const page: ListBookEventsResult = {
        items: result.getItems(),
    };
    const nextCursor = result.getCursor();
    if (nextCursor) {
        page.cursor = nextCursor;
    }
    return page;
}

/**
 * Lists events and returns a ListResult ready for rendering.
 * Includes full event payloads with botResponses for LLM debugging.
 */
export async function listEventsFormatted(
    bookId: string,
    options: ListBookEventsOptions
): Promise<ListResult> {
    const result = await listEvents(bookId, options);

    const listResult: ListResult = {
        items: result.items.map(event => event.json()),
    };
    if (result.cursor) {
        listResult.cursor = result.cursor;
    }
    const hint = buildEventListHint(bookId, options, result.cursor);
    if (hint) {
        listResult.hint = hint;
    }
    return listResult;
}

function toListEventsOptions(options: ListBookEventsOptions): ListEventsOptions {
    const listOptions: ListEventsOptions = {
        limit: options.limit ?? DEFAULT_EVENT_LIST_LIMIT,
    };

    if (options.afterDate !== undefined) {
        listOptions.afterDate = options.afterDate;
    }
    if (options.beforeDate !== undefined) {
        listOptions.beforeDate = options.beforeDate;
    }
    if (options.resourceId !== undefined) {
        listOptions.resourceId = options.resourceId;
    }
    if (options.onError === true) {
        listOptions.onError = true;
    }
    if (options.type !== undefined) {
        listOptions.type = options.type;
    }
    if (options.cursor !== undefined) {
        listOptions.cursor = options.cursor;
    }

    return listOptions;
}

function buildEventListHint(
    bookId: string,
    options: ListBookEventsOptions,
    cursor: string | undefined
): string | undefined {
    if (!cursor) {
        return undefined;
    }

    const limit = options.limit ?? DEFAULT_EVENT_LIST_LIMIT;
    const parts = [`bkper event list -b ${quoteShellArg(bookId)}`];

    if (options.afterDate) {
        parts.push(`--after ${quoteShellArg(options.afterDate)}`);
    }
    if (options.beforeDate) {
        parts.push(`--before ${quoteShellArg(options.beforeDate)}`);
    }
    if (options.resourceId) {
        parts.push(`--resource ${quoteShellArg(options.resourceId)}`);
    }
    if (options.onError) {
        parts.push('--error');
    }
    if (options.type) {
        parts.push(`--type ${quoteShellArg(options.type)}`);
    }

    parts.push(`--limit ${limit}`);
    parts.push(`--cursor ${quoteShellArg(cursor)}`);

    return [`Next cursor: ${cursor}`, `Next page: ${parts.join(' ')}`].join('\n');
}
