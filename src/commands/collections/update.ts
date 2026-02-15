import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

/**
 * Options for updating a collection.
 */
export interface UpdateCollectionOptions {
    name?: string;
}

/**
 * Updates an existing collection with the provided options.
 *
 * @param collectionId - The ID of the collection to update
 * @param options - Fields to update on the collection
 * @returns The updated Collection
 * @throws Error if the collection is not found
 */
export async function updateCollection(
    collectionId: string,
    options: UpdateCollectionOptions
): Promise<Collection> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    const collection = collections.find(c => c.getId() === collectionId);

    if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
    }

    if (options.name !== undefined) collection.setName(options.name);

    return collection.update();
}
