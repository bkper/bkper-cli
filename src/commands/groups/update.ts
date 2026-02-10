import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface UpdateGroupOptions {
    name?: string;
    hidden?: boolean;
    property?: string[];
}

export async function updateGroup(
    bookId: string,
    groupIdOrName: string,
    options: UpdateGroupOptions
): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }

    if (options.name !== undefined) group.setName(options.name);
    if (options.hidden !== undefined) group.setHidden(options.hidden);

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            if (value === '') {
                group.deleteProperty(key);
            } else {
                group.setProperty(key, value);
            }
        }
    }

    return group.update();
}
