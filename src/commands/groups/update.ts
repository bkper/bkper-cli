import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { throwIfErrors } from '../../utils/validation.js';

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

    const errors: string[] = [];

    if (options.name !== undefined) group.setName(options.name);
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

    throwIfErrors(errors);

    return group.update();
}
