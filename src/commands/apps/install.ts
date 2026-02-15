import { getBkperInstance } from '../../bkper-factory.js';
import { Integration } from 'bkper-js';

/**
 * Installs an app into a book by creating an integration.
 *
 * @param bookId - The ID of the book to install the app into
 * @param appId - The ID of the app to install
 * @returns The created Integration
 */
export async function installApp(bookId: string, appId: string): Promise<Integration> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    return book.createIntegration({ agentId: appId });
}
