import { getBkperInstance } from '../../bkper-factory.js';
import { Integration } from 'bkper-js';

export async function installApp(bookId: string, appId: string): Promise<Integration> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    return book.createIntegration({ agentId: appId });
}
