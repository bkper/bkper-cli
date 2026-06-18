import { File as BkperFile } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { OutputFormat, ListResult } from '../../render/output.js';
import { quoteShellArg } from '../../utils/shell-quote.js';

export const DEFAULT_FILE_LIST_LIMIT = 100;

export interface ListFilesOptions {
    limit?: number;
    cursor?: string;
}

export interface ListFilesResult {
    items: BkperFile[];
    cursor?: string;
}

/**
 * Lists one page of files from a book.
 *
 * @param bookId - The ID of the book to list files from
 * @param options - Pagination options
 * @returns File page items and optional next cursor
 */
export async function listFiles(
    bookId: string,
    options: ListFilesOptions = {}
): Promise<ListFilesResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const limit = options.limit ?? DEFAULT_FILE_LIST_LIMIT;
    const result = await book.listFiles(limit, options.cursor);

    const page: ListFilesResult = {
        items: result.getItems(),
    };
    const nextCursor = result.getCursor();
    if (nextCursor) {
        page.cursor = nextCursor;
    }
    return page;
}

/**
 * Lists files and returns a ListResult ready for rendering.
 */
export async function listFilesFormatted(
    bookId: string,
    options: ListFilesOptions,
    format: OutputFormat
): Promise<ListResult> {
    const result = await listFiles(bookId, options);

    if (format === 'json') {
        const jsonResult: ListResult = {
            kind: 'json',
            items: result.items.map(file => fileToListJson(file)),
        };
        if (result.cursor) {
            jsonResult.cursor = result.cursor;
        }
        return jsonResult;
    }

    return {
        kind: 'matrix',
        matrix: buildFilesMatrix(result.items),
        footer: buildFileListFooter(bookId, options, result.cursor),
    };
}

function fileToListJson(file: BkperFile): bkper.File {
    const json = {...file.json()};
    delete json.content;
    return json;
}

function buildFilesMatrix(files: BkperFile[]): unknown[][] {
    const matrix: unknown[][] = [
        ['ID', 'Name', 'Content Type', 'Size', 'Created At', 'Updated At', 'URL', 'Properties'],
    ];

    for (const file of files) {
        const json = fileToListJson(file);
        matrix.push([
            json.id || '',
            json.name || '',
            json.contentType || '',
            json.size ?? '',
            json.createdAt || '',
            json.updatedAt || '',
            json.url || '',
            formatProperties(json.properties),
        ]);
    }

    return matrix;
}

function formatProperties(properties: {[name: string]: string} | undefined): string {
    if (!properties || Object.keys(properties).length === 0) {
        return '';
    }
    return JSON.stringify(properties);
}

function buildFileListFooter(
    bookId: string,
    options: ListFilesOptions,
    cursor: string | undefined
): string | undefined {
    if (!cursor) {
        return undefined;
    }

    const limit = options.limit ?? DEFAULT_FILE_LIST_LIMIT;
    return [
        `Next cursor: ${cursor}`,
        `Next page: bkper file list -b ${quoteShellArg(bookId)} --limit ${limit} --cursor ${quoteShellArg(
            cursor
        )}`,
    ].join('\n');
}
