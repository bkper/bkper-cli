import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

/**
 * Deletes a collection by its ID.
 *
 * @param collectionId - The ID of the collection to delete
 * @returns The books that were in the deleted collection
 * @throws Error if the collection is not found
 */
export async function deleteCollection(collectionId: string): Promise<Book[]> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    const collection = collections.find(c => c.getId() === collectionId);

    if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
    }

    return collection.remove();
}
