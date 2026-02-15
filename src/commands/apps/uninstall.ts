import { getBkperInstance } from '../../bkper-factory.js';
import { Integration } from 'bkper-js';

/**
 * Uninstalls an app from a book by removing its integration.
 *
 * @param bookId - The ID of the book to uninstall the app from
 * @param appId - The ID of the app to uninstall
 * @returns The removed Integration
 * @throws Error if the app is not found in the book
 */
export async function uninstallApp(bookId: string, appId: string): Promise<Integration> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const integrations = await book.getIntegrations();

    const integration = integrations.find(i => i.getAgentId() === appId);

    if (!integration) {
        throw new Error(`App not found in book: ${appId}`);
    }

    return integration.remove();
}
