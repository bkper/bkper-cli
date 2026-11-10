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

/**
 * Retrieves a single app ready for rendering, its readme once: as Markdown, not also as HTML.
 *
 * @param appId - The unique identifier of the app to retrieve
 * @returns The app data
 */
export async function getAppFormatted(appId: string): Promise<bkper.App> {
    const app = { ...(await getApp(appId)).json() };
    delete app.readme;
    return app;
}
