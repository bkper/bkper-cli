import { getBkperInstance } from '../../bkper-factory.js';

export async function getGroup(bookId: string, groupIdOrName: string): Promise<bkper.Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }
    return group.json();
}
