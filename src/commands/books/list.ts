import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';
import type { ListResult } from '../../render/output.js';

/**
 * Lists books matching an optional query string.
 *
 * @param query - Optional search query to filter books
 * @returns Array of matching Book instances
 */
export async function listBooks(query?: string): Promise<Book[]> {
    const bkper = getBkperInstance();
    return bkper.getBooks(query);
}

/**
 * Lists books and returns a ListResult ready for rendering.
 */
export async function listBooksFormatted(query: string | undefined): Promise<ListResult> {
    const books = await listBooks(query);
    return { items: books.map(b => b.json()) };
}
