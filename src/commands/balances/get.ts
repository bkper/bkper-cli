import { getBkperInstance } from '../../bkper-factory.js';

export interface GetBalancesOptions {
    query: string;
    expanded?: number;
}

export async function getBalancesMatrix(
    bookId: string,
    options: GetBalancesOptions
): Promise<unknown[][]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const report = await book.getBalancesReport(options.query);
    const builder = report.createDataTable().formatValues(true).formatDates(true);

    if (options.expanded) {
        builder.expanded(options.expanded);
    }

    return builder.build();
}
