import { getBkperInstance } from '../../bkper-factory.js';

export async function listGroups(bookId: string): Promise<bkper.Group[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const groups = await book.getGroups();
    return groups ? groups.map(group => group.json()) : [];
}
