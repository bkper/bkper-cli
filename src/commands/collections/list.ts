import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';

/**
 * Fetches all collections for the authenticated user.
 *
 * @returns Array of all collections
 */
export async function listCollections(): Promise<Collection[]> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    return collections;
}

/**
 * Lists collections and returns a ListResult ready for rendering.
 * Absorbs manual matrix building and JSON mapping.
 */
export async function listCollectionsFormatted(format: OutputFormat): Promise<ListResult> {
    const collections = await listCollections();

    if (format === 'json') {
        return { kind: 'json', data: collections.map(c => c.json()) };
    }

    if (collections.length === 0) {
        return { kind: 'matrix', matrix: [['No collections found.']] };
    }

    const matrix: unknown[][] = [['ID', 'Name', 'Books']];
    for (const col of collections) {
        const books = col.getBooks();
        matrix.push([col.getId() || '', col.getName() || '', books.length.toString()]);
    }
    return { kind: 'matrix', matrix };
}
