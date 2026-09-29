import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import type { ListResult } from '../../render/output.js';

/**
 * Retrieves all groups from the specified book.
 *
 * Fetches the book with groups pre-loaded in a single API call,
 * so that subsequent operations work from the in-memory cache.
 *
 * @param bookId - The ID of the book to list groups from
 * @returns Array of groups in the book, or an empty array if none exist
 */
export async function listGroups(bookId: string): Promise<Group[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId, false, true);
    const groups = await book.getGroups();
    return groups || [];
}

/**
 * Lists groups and returns a ListResult ready for rendering.
 */
export async function listGroupsFormatted(bookId: string): Promise<ListResult> {
    const groups = await listGroups(bookId);
    return { items: groups.map(g => g.json()) };
}
