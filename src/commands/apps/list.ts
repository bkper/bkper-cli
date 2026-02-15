import { getBkperInstance } from '../../bkper-factory.js';
import type { OutputFormat, ListResult } from '../../render/output.js';

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
 * Absorbs manual matrix building and JSON mapping.
 */
export async function listAppsFormatted(format: OutputFormat): Promise<ListResult> {
    const apps = await listApps();

    if (format === 'json') {
        return { kind: 'json', data: apps };
    }

    if (apps.length === 0) {
        return { kind: 'matrix', matrix: [['No results found.']] };
    }

    const matrix: unknown[][] = [['ID', 'Name', 'Published']];
    for (const app of apps) {
        matrix.push([app.id || '', app.name || '', app.published ? 'Yes' : 'No']);
    }
    return { kind: 'matrix', matrix };
}
