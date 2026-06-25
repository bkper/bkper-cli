import { App } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Retrieves a single app by its ID.
 *
 * @param appId - The unique identifier of the app to retrieve
 * @returns The requested App instance
 */
export async function getApp(appId: string): Promise<App> {
    const bkper = getBkperInstance();
    return bkper.getApp(appId);
}
