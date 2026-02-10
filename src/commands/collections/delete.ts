import { getBkperInstance } from '../../bkper-factory.js';
import { Book } from 'bkper-js';

export async function deleteCollection(collectionId: string): Promise<Book[]> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    const collection = collections.find(c => c.getId() === collectionId);

    if (!collection) {
        throw new Error(`Collection not found: ${collectionId}`);
    }

    return collection.remove();
}
