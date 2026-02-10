import { getBkperInstance } from '../../bkper-factory.js';
import { Collection } from 'bkper-js';

export interface CreateCollectionOptions {
    name: string;
}

export async function createCollection(options: CreateCollectionOptions): Promise<Collection> {
    const bkper = getBkperInstance();
    const collection = new Collection({ name: options.name }, bkper.getConfig());
    return collection.setName(options.name).create();
}
