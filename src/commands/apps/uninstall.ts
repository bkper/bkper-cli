import { getBkperInstance } from '../../bkper-factory.js';
import { Integration } from 'bkper-js';

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
