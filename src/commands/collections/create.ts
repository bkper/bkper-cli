import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

/**
 * Options for creating a new collection.
 */
export interface CreateCollectionOptions {
    name: string;
}

/**
 * Creates a new collection with the given name.
 *
 * @param options - Collection creation options
 * @returns The newly created Collection
 */
export async function createCollection(options: CreateCollectionOptions): Promise<Collection> {
    const bkper = getBkperInstance();
    const collection = new Collection({ name: options.name }, bkper.getConfig());
    return collection.setName(options.name).create();
}
