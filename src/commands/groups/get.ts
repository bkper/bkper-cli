import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';

/**
 * Retrieves a group by its ID or name from the specified book.
 *
 * @param bookId - The ID of the book containing the group
 * @param groupIdOrName - The ID or name of the group to retrieve
 * @returns The matching Group
 */
export async function getGroup(bookId: string, groupIdOrName: string): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }
    return group;
}
