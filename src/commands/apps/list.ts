import { getBkperInstance } from '../../bkper-factory.js';

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
