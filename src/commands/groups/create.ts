import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';

export interface CreateGroupOptions {
    name: string;
    parent?: string;
    hidden?: boolean;
    properties?: Record<string, string>;
}

export async function createGroup(bookId: string, options: CreateGroupOptions): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const group = new Group(book).setName(options.name);

    if (options.hidden !== undefined) group.setHidden(options.hidden);
    if (options.properties) group.setProperties(options.properties);

    if (options.parent) {
        const parentGroup = await book.getGroup(options.parent);
        if (parentGroup) {
            group.setParent(parentGroup);
        }
    }

    return group.create();
}
