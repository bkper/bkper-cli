import { BalanceType } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { OutputFormat } from '../../render/output.js';
import { warnIfSuspiciousDateVariableQuery } from '../../utils/query-warning.js';

/**
 * Options for listing account balances from a book.
 */
export interface ListBalancesOptions {
    query: string;
    expanded?: number;
    format?: OutputFormat;
    trial?: boolean;
}

/**
 * Determines the appropriate BalanceType based on query operators and output view.
 * Trial balances use totals; otherwise after: means PERIOD and all other queries
 * use CUMULATIVE.
 */
export function resolveBalanceType(query: string, trial = false): BalanceType {
    if (trial) {
        return BalanceType.TOTAL;
    }
    return query.includes('after:') ? BalanceType.PERIOD : BalanceType.CUMULATIVE;
}

/**
 * Adds the missing trial balance headers from the bkper-js total table builder.
 * CSV total tables already contain a header for metadata, so replace its balance
 * column while preserving property columns.
 */
function addTrialHeaders(matrix: unknown[][], csv: boolean): unknown[][] {
    if (matrix.length === 0) {
        return matrix;
    }

    const firstRow = matrix[0].map(cell => String(cell).toLowerCase());
    if (firstRow[0] === 'name' && firstRow[1] === 'debit' && firstRow[2] === 'credit') {
        return matrix;
    }

    if (csv) {
        const [header, ...rows] = matrix;
        return [['Name', 'Debit', 'Credit', ...header.slice(2)], ...rows];
    }
    return [['Name', 'Debit', 'Credit'], ...matrix];
}

/**
 * Fetches balances from a book and returns them as a data table matrix.
 *
 * @param bookId - The ID of the book to query balances from
 * @param options - Query and formatting options
 * @returns A 2D array with headers and balance data rows
 */
export async function listBalancesMatrix(
    bookId: string,
    options: ListBalancesOptions
): Promise<unknown[][]> {
    warnIfSuspiciousDateVariableQuery(options.query);

    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const balanceType = resolveBalanceType(options.query, options.trial);

    const report = await book.getBalancesReport(options.query);
    const builder = report.createDataTable().type(balanceType);

    if (options.trial) {
        builder.trial(true).period(options.query.includes('after:'));
    }

    if (options.format === 'csv') {
        // CSV: raw values for machine consumption, all metadata
        builder.properties(true).hiddenProperties(true);
    } else {
        // Table/JSON: human-readable formatted values
        builder.formatValues(true).formatDates(true);
    }

    if (options.expanded) {
        builder.expanded(options.expanded);
    }

    const matrix = builder.build();
    return options.trial ? addTrialHeaders(matrix, options.format === 'csv') : matrix;
}
