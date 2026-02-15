import { formatTable, formatItem } from './table-formatter.js';
import { formatCsv } from './csv-formatter.js';

/**
 * Output format type for CLI rendering.
 */
export type OutputFormat = 'table' | 'json' | 'csv';

/**
 * Structured result from list commands, allowing cli.ts to render
 * without knowing how the data was built.
 */
export type ListResult =
    | { kind: 'json'; data: unknown }
    | { kind: 'matrix'; matrix: unknown[][]; footer?: string };

/**
 * Renders a ListResult to stdout based on the active output format.
 */
export function renderListResult(result: ListResult, format: OutputFormat): void {
    if (result.kind === 'json') {
        console.log(JSON.stringify(result.data, null, 2));
        return;
    }
    renderTable(result.matrix, format);
    if (result.footer && format === 'table') {
        console.log(result.footer);
    }
}

/**
 * Renders a 2D matrix as a formatted table, JSON, or CSV.
 *
 * @param matrix - 2D array where row 0 is headers and rows 1+ are data
 * @param format - Output format: 'table' (default), 'json', or 'csv'
 */
export function renderTable(matrix: unknown[][], format: OutputFormat): void {
    switch (format) {
        case 'json':
            console.log(JSON.stringify(matrix, null, 2));
            return;
        case 'csv': {
            const csv = formatCsv(matrix);
            console.log(csv || 'No results found.');
            return;
        }
        default: {
            const formatted = formatTable(matrix);
            console.log(formatted || 'No results found.');
        }
    }
}

/**
 * Renders a single item as key-value pairs, JSON, or JSON (for CSV, since
 * single items are not tabular, CSV falls back to JSON).
 *
 * @param item - Record to render
 * @param format - Output format: 'table' (default), 'json', or 'csv'
 */
export function renderItem(item: object, format: OutputFormat): void {
    if (format === 'json' || format === 'csv') {
        console.log(JSON.stringify(item, null, 2));
        return;
    }

    const formatted = formatItem(item as Record<string, unknown>);
    console.log(formatted || 'No results found.');
}
