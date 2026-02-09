import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';

export async function getGroup(bookId: string, groupIdOrName: string): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }
    return group;
}
