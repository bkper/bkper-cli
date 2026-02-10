import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface CreateTransactionOptions {
    date: string;
    amount: string | number;
    description?: string;
    from?: string;
    to?: string;
    url?: string[];
    remoteId?: string[];
    property?: string[];
}

export async function createTransaction(
    bookId: string,
    options: CreateTransactionOptions
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const tx = new Transaction(book).setDate(options.date).setAmount(options.amount);

    if (options.description) tx.setDescription(options.description);

    if (options.from) {
        const creditAccount = await book.getAccount(options.from);
        if (creditAccount) tx.setCreditAccount(creditAccount);
    }

    if (options.to) {
        const debitAccount = await book.getAccount(options.to);
        if (debitAccount) tx.setDebitAccount(debitAccount);
    }

    if (options.url) {
        for (const u of options.url) {
            tx.addUrl(u);
        }
    }

    if (options.remoteId) {
        for (const rid of options.remoteId) {
            tx.addRemoteId(rid);
        }
    }

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            if (value === '') {
                tx.deleteProperty(key);
            } else {
                tx.setProperty(key, value);
            }
        }
    }

    const results = await book.batchCreateTransactions([tx]);
    return results[0];
}
