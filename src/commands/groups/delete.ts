import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';

/**
 * Deletes a group from the specified book.
 *
 * @param bookId - The ID of the book containing the group
 * @param groupIdOrName - The ID or name of the group to delete
 * @returns The removed Group
 */
export async function deleteGroup(bookId: string, groupIdOrName: string): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }

    return group.remove();
}
