import { getBkperInstance } from '../../bkper-factory.js';
import { Group, GroupsDataTableBuilder } from 'bkper-js';
import type { OutputFormat, ListResult } from '../../render/output.js';

export async function listGroups(bookId: string): Promise<Group[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const groups = await book.getGroups();
    return groups || [];
}

/**
 * Lists groups and returns a ListResult ready for rendering.
 * Absorbs GroupsDataTableBuilder config and JSON mapping.
 */
export async function listGroupsFormatted(
    bookId: string,
    format: OutputFormat
): Promise<ListResult> {
    const groups = await listGroups(bookId);

    if (format === 'json') {
        return { kind: 'json', data: groups.map(g => g.json()) };
    }

    const builder = new GroupsDataTableBuilder(groups).ids(true).tree(true);
    if (format === 'csv') {
        builder.properties(true).hiddenProperties(true);
    }
    const matrix = builder.build();
    return { kind: 'matrix', matrix };
}
