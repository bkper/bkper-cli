import { getBkperInstance } from '../../bkper-factory.js';
import type { ListResult } from '../../render/output.js';

/**
 * Lists the apps the authenticated user has access to, or the apps installed in a book.
 *
 * @param bookId - When given, list the apps installed in this book
 * @returns Array of app data objects
 */
export async function listApps(bookId?: string): Promise<bkper.App[]> {
    const bkper = getBkperInstance();
    const apps = bookId ? await (await bkper.getBook(bookId)).getApps() : await bkper.getApps();
    return apps.map(app => app.json());
}

/**
 * Lists apps and returns a ListResult ready for rendering.
 * Readmes are omitted from list output; `app get` returns them.
 */
export async function listAppsFormatted(bookId?: string): Promise<ListResult> {
    return { items: (await listApps(bookId)).map(appToListJson) };
}

function appToListJson(app: bkper.App): bkper.App {
    const json = { ...app };
    delete json.readme;
    delete json.readmeMd;
    return json;
}
