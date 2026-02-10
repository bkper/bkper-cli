import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

export interface UpdateCollectionOptions {
    name?: string;
}

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
