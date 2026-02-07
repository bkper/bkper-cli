import { getBkperInstance } from '../../bkper-factory.js';

export interface UpdateGroupOptions {
    name?: string;
    hidden?: boolean;
    properties?: Record<string, string>;
}

export async function updateGroup(
    bookId: string,
    groupIdOrName: string,
    options: UpdateGroupOptions
): Promise<bkper.Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const group = await book.getGroup(groupIdOrName);
    if (!group) {
        throw new Error(`Group not found: ${groupIdOrName}`);
    }

    if (options.name !== undefined) group.setName(options.name);
    if (options.hidden !== undefined) group.setHidden(options.hidden);
    if (options.properties !== undefined) group.setProperties(options.properties);

    const updated = await group.update();
    return updated.json();
}
