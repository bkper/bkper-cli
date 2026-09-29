import { getBkperInstance } from '../../bkper-factory.js';
import type { ListResult } from '../../render/output.js';

/**
 * Lists all apps the authenticated user has access to.
 *
 * @returns Array of app data objects
 */
export async function listApps(): Promise<bkper.App[]> {
    const bkper = getBkperInstance();
    const apps = await bkper.getApps();
    return apps.map(app => app.json());
}

/**
 * Lists apps and returns a ListResult ready for rendering.
 */
export async function listAppsFormatted(): Promise<ListResult> {
    return { items: await listApps() };
}
