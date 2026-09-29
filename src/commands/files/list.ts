import { File as BkperFile } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { ListResult } from '../../render/output.js';
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
 * File content is omitted from list output.
 */
export async function listFilesFormatted(
    bookId: string,
    options: ListFilesOptions
): Promise<ListResult> {
    const result = await listFiles(bookId, options);

    const listResult: ListResult = {
        items: result.items.map(file => fileToListJson(file)),
    };
    if (result.cursor) {
        listResult.cursor = result.cursor;
    }
    const hint = buildFileListHint(bookId, options, result.cursor);
    if (hint) {
        listResult.hint = hint;
    }
    return listResult;
}

function fileToListJson(file: BkperFile): bkper.File {
    const json = {...file.json()};
    delete json.content;
    return json;
}

function buildFileListHint(
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
