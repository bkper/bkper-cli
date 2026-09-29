import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';
import type { ListResult } from '../../render/output.js';

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
 */
export async function listCollectionsFormatted(): Promise<ListResult> {
    const collections = await listCollections();
    return { items: collections.map(c => c.json()) };
}
