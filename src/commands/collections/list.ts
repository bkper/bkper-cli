import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

export async function listCollections(): Promise<Collection[]> {
    const bkper = getBkperInstance();
    const collections = await bkper.getCollections();
    return collections;
}
