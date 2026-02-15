import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { throwIfErrors } from '../../utils/validation.js';

/** Options for creating a new group in a book. */
export interface CreateGroupOptions {
    name: string;
    parent?: string;
    hidden?: boolean;
    property?: string[];
}

/**
 * Creates a new group in the specified book.
 *
 * @param bookId - The ID of the book to create the group in
 * @param options - Group creation options including name, parent, and properties
 * @returns The newly created Group
 */
export async function createGroup(bookId: string, options: CreateGroupOptions): Promise<Group> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const errors: string[] = [];

    const group = new Group(book).setName(options.name);

    if (options.hidden !== undefined) group.setHidden(options.hidden);

    if (options.property) {
        for (const raw of options.property) {
            try {
                const [key, value] = parsePropertyFlag(raw);
                if (value === '') {
                    group.deleteProperty(key);
                } else {
                    group.setProperty(key, value);
                }
            } catch (err: unknown) {
                errors.push((err as Error).message);
            }
        }
    }

    if (options.parent) {
        const parentGroup = await book.getGroup(options.parent);
        if (parentGroup) {
            group.setParent(parentGroup);
        } else {
            errors.push(`Parent group not found: ${options.parent}`);
        }
    }

    throwIfErrors(errors);

    return group.create();
}
