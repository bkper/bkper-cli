import { getBkperInstance } from '../../bkper-factory.js';
import { Book, Transaction, Account, TransactionList } from 'bkper-js';

export interface ListTransactionsOptions {
    query: string;
    limit?: number;
    cursor?: string;
}

export interface ListTransactionsResult {
    book: Book;
    items: Transaction[];
    account?: Account;
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
    const account = await result.getAccount();
    return {
        book,
        items: items || [],
        account,
        cursor: result.getCursor(),
    };
}
