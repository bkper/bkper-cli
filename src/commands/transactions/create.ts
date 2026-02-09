import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';

export interface CreateTransactionInput {
    date: string;
    amount: string | number;
    description?: string;
    from?: string;
    to?: string;
    properties?: Record<string, string>;
    urls?: string[];
    remoteIds?: string[];
}

export async function createTransactions(
    bookId: string,
    inputs: CreateTransactionInput[]
): Promise<Transaction[]> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const transactions: Transaction[] = [];

    for (const input of inputs) {
        const tx = new Transaction(book).setDate(input.date).setAmount(input.amount);

        if (input.description) tx.setDescription(input.description);
        if (input.properties) tx.setProperties(input.properties);
        if (input.urls) tx.setUrls(input.urls);

        if (input.from) {
            const creditAccount = await book.getAccount(input.from);
            if (creditAccount) tx.setCreditAccount(creditAccount);
        }
        if (input.to) {
            const debitAccount = await book.getAccount(input.to);
            if (debitAccount) tx.setDebitAccount(debitAccount);
        }

        transactions.push(tx);
    }

    return book.batchCreateTransactions(transactions);
}
