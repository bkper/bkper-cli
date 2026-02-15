import { getBkperInstance } from '../../bkper-factory.js';
import { Book, BooksDataTableBuilder } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';

export async function listBooks(query?: string): Promise<Book[]> {
    const bkper = getBkperInstance();
    return bkper.getBooks(query);
}

/**
 * Lists books and returns a ListResult ready for rendering.
 * Absorbs sorting, BooksDataTableBuilder config, and JSON mapping
 * so cli.ts doesn't need to know about any of this.
 */
export async function listBooksFormatted(
    query: string | undefined,
    format: OutputFormat
): Promise<ListResult> {
    const books = await listBooks(query);

    if (format === 'json') {
        return { kind: 'json', data: books.map(b => b.json()) };
    }

    if (books.length === 0) {
        return { kind: 'matrix', matrix: [['No results found.']] };
    }

    books.sort((a, b) => {
        const collA = a.getCollection()?.getName();
        const collB = b.getCollection()?.getName();
        if (collA && !collB) return -1;
        if (!collA && collB) return 1;
        let ret = (collA || '').localeCompare(collB || '');
        if (ret === 0) {
            ret = (a.getName() || '').localeCompare(b.getName() || '');
        }
        return ret;
    });

    const builder = new BooksDataTableBuilder(books).ids(true);
    if (format === 'csv') {
        builder.properties(true).hiddenProperties(true);
    }
    const matrix = builder.build();
    return { kind: 'matrix', matrix };
}
