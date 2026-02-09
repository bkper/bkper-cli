import { formatTable, formatItem } from './table-formatter.js';

/**
 * Renders a 2D matrix as a formatted table or JSON.
 *
 * @param matrix - 2D array where row 0 is headers and rows 1+ are data
 * @param json - If true, output as JSON; otherwise output as formatted table
 */
export function renderTable(matrix: unknown[][], json: boolean): void {
    if (json) {
        console.log(JSON.stringify(matrix, null, 2));
        return;
    }

    const formatted = formatTable(matrix);
    console.log(formatted || 'No results found.');
}

/**
 * Renders a single item as key-value pairs or JSON.
 *
 * @param item - Record to render
 * @param json - If true, output as JSON; otherwise output as key-value pairs
 */
export function renderItem(item: object, json: boolean): void {
    if (json) {
        console.log(JSON.stringify(item, null, 2));
        return;
    }

    const formatted = formatItem(item as Record<string, unknown>);
    console.log(formatted || 'No results found.');
}
