import { Event, EventType, type ListEventsOptions } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { OutputFormat, ListResult } from '../../render/output.js';
import { quoteShellArg } from '../../utils/shell-quote.js';

export const DEFAULT_EVENT_LIST_LIMIT = 50;
const PREVIEW_MAX_LENGTH = 80;

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
 * JSON includes full event payloads with botResponses for LLM debugging.
 */
export async function listEventsFormatted(
    bookId: string,
    options: ListBookEventsOptions,
    format: OutputFormat
): Promise<ListResult> {
    const result = await listEvents(bookId, options);

    if (format === 'json') {
        const jsonResult: ListResult = {
            kind: 'json',
            items: result.items.map(event => event.json()),
        };
        if (result.cursor) {
            jsonResult.cursor = result.cursor;
        }
        return jsonResult;
    }

    return {
        kind: 'matrix',
        matrix: buildEventsMatrix(result.items),
        footer: buildEventListFooter(bookId, options, result.cursor),
    };
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

function buildEventsMatrix(events: Event[]): unknown[][] {
    const matrix: unknown[][] = [
        ['ID', 'Type', 'Created', 'Resource', 'User', 'Agent', 'Responses', 'Errors', 'Preview'],
    ];

    for (const event of events) {
        const json = event.json();
        const botResponses = json.botResponses || [];
        const errorResponses = botResponses.filter(response => response.type === 'ERROR');

        matrix.push([
            json.id || '',
            json.type || '',
            json.createdOn || json.createdAt || '',
            json.resource || '',
            formatUser(json.user),
            formatAgent(json.agent),
            botResponses.length,
            errorResponses.length,
            formatBotResponsePreview(botResponses),
        ]);
    }

    return matrix;
}

function formatUser(user: bkper.User | undefined): string {
    if (!user) {
        return '';
    }
    return user.email || user.name || user.id || '';
}

function formatAgent(agent: bkper.Agent | undefined): string {
    if (!agent) {
        return '';
    }
    return agent.name || agent.id || '';
}

function formatBotResponsePreview(botResponses: bkper.BotResponse[]): string {
    const preferred =
        botResponses.find(response => response.type === 'ERROR' && response.message) ||
        botResponses.find(response => response.message);

    if (!preferred?.message) {
        return '';
    }

    return truncate(preferred.message, PREVIEW_MAX_LENGTH);
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 1)}…`;
}

function buildEventListFooter(
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
