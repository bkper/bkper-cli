import { BalanceType } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import type { OutputFormat } from '../../render/output.js';

export interface ListBalancesOptions {
    query: string;
    expanded?: number;
    format?: OutputFormat;
}

/**
 * Determines the appropriate BalanceType based on query operators.
 * Uses after: presence as the heuristic: after: means PERIOD, otherwise CUMULATIVE.
 */
export function resolveBalanceType(query: string): BalanceType {
    return query.includes('after:') ? BalanceType.PERIOD : BalanceType.CUMULATIVE;
}

export async function listBalancesMatrix(
    bookId: string,
    options: ListBalancesOptions
): Promise<unknown[][]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const balanceType = resolveBalanceType(options.query);

    const report = await book.getBalancesReport(options.query);
    const builder = report.createDataTable().type(balanceType);

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

    return builder.build();
}
