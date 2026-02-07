import { getBkperInstance } from '../../bkper-factory.js';

export interface ListTransactionsOptions {
    query: string;
    limit?: number;
    cursor?: string;
}

export interface ListTransactionsResult {
    items: bkper.Transaction[];
    cursor?: string;
}

export async function listTransactions(
    bookId: string,
    options: ListTransactionsOptions
): Promise<ListTransactionsResult> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const result = await book.listTransactions(options.query, options.limit, options.cursor);
    const items = result.getItems();
    return {
        items: items ? items.map(tx => tx.json()) : [],
        cursor: result.getCursor(),
    };
}
