import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

/**
 * Creates multiple groups from stdin items using the batch API.
 * Outputs a flat JSON array of all created groups.
 *
 * Stdin items must follow the bkper.Group format exactly.
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items as bkper.Group payloads
 * @param propertyOverrides - CLI --property flags that override stdin properties
 */
export async function batchCreateGroups(
    bookId: string,
    items: Record<string, unknown>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const groups: Group[] = [];

    for (const item of items) {
        const group = new Group(book, item as bkper.Group);

        // CLI --property flags override stdin properties
        if (propertyOverrides) {
            for (const raw of propertyOverrides) {
                const [key, value] = parsePropertyFlag(raw);
                if (value === '') {
                    group.deleteProperty(key);
                } else {
                    group.setProperty(key, value);
                }
            }
        }

        groups.push(group);
    }

    const results = await book.batchCreateGroups(groups);
    const allResults = results.map(result => result.json());

    console.log(JSON.stringify(allResults, null, 2));
}
