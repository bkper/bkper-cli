import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';

export async function listGroups(bookId: string): Promise<Group[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const groups = await book.getGroups();
    return groups || [];
}
