import { getBkperInstance } from '../../bkper-factory.js';
import { Group } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import type { StdinValue } from '../../input/index.js';

const CHUNK_SIZE = 100;

/**
 * Creates multiple groups from stdin items using the batch API.
 * Outputs NDJSON (one JSON object per line) as each chunk completes.
 *
 * Stdin field names follow the Bkper API format:
 *   name, parent, hidden
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items (field-value maps)
 * @param propertyOverrides - CLI --property flags that override stdin fields
 */
export async function batchCreateGroups(
    bookId: string,
    items: Record<string, StdinValue>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const groups: Group[] = [];

        for (const item of chunk) {
            const group = new Group(book);
            if (item.name) group.setName(String(item.name));
            if (item.hidden !== undefined) {
                const hidden =
                    typeof item.hidden === 'boolean' ? item.hidden : item.hidden === 'true';
                group.setHidden(hidden);
            }

            // Set properties from stdin fields (excluding known fields)
            const knownFields = new Set(['name', 'parent', 'hidden']);
            for (const [key, value] of Object.entries(item)) {
                if (!knownFields.has(key) && value !== '') {
                    group.setProperty(key, String(value));
                }
            }

            // CLI --property flags override stdin
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

            if (item.parent) {
                const parentGroup = await book.getGroup(String(item.parent));
                if (parentGroup) {
                    group.setParent(parentGroup);
                }
            }

            groups.push(group);
        }

        const results = await book.batchCreateGroups(groups);
        for (const result of results) {
            console.log(JSON.stringify(result.json()));
        }
    }
}
