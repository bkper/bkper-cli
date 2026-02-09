import { BalanceType } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

export interface GetBalancesOptions {
    query: string;
    expanded?: number;
}

/**
 * Determines the appropriate BalanceType based on query operators.
 * Uses after: presence as the heuristic: after: means PERIOD, otherwise CUMULATIVE.
 */
export function resolveBalanceType(query: string): BalanceType {
    return query.includes('after:') ? BalanceType.PERIOD : BalanceType.CUMULATIVE;
}

export async function getBalancesMatrix(
    bookId: string,
    options: GetBalancesOptions
): Promise<unknown[][]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const balanceType = resolveBalanceType(options.query);

    const report = await book.getBalancesReport(options.query);
    const builder = report.createDataTable().formatValues(true).formatDates(true).type(balanceType);

    if (options.expanded) {
        builder.expanded(options.expanded);
    }

    return builder.build();
}
