import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

/**
 * Retrieves a collection by its ID.
 *
 * @param collectionId - The ID of the collection to retrieve
 * @returns The matching Collection
 * @throws Error if the collection is not found
 */
export async function getCollection(collectionId: string): Promise<Collection> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    const collection = collections.find(c => c.getId() === collectionId);

    if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
    }

    return collection;
}
