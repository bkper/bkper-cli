import { getBkperInstance } from '../../bkper-factory.js';

export interface GetBalancesOptions {
    query: string;
    raw?: boolean;
    expanded?: number;
}

export interface BalanceItem {
    accountOrGroup: string;
    periodBalance: string;
    cumulativeBalance: string;
}

export interface GetBalancesResult {
    items: BalanceItem[];
    matrix?: unknown[][];
}

export async function getBalances(
    bookId: string,
    options: GetBalancesOptions
): Promise<GetBalancesResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const report = await book.getBalancesReport(options.query);
    const containers = report.getBalancesContainers();

    const items: BalanceItem[] = containers.map(container => ({
        accountOrGroup: container.getName(),
        periodBalance: container.getPeriodBalance().toString(),
        cumulativeBalance: container.getCumulativeBalance().toString(),
    }));

    let matrix: unknown[][] | undefined;
    if (options.raw || options.expanded) {
        const builder = report.createDataTable().formatValues(false).formatDates(true).raw(true);

        if (options.expanded) {
            builder.expanded(options.expanded);
        }

        matrix = builder.build();
    }

    return { items, matrix };
}
