import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface UpdateTransactionOptions {
    date?: string;
    amount?: string | number;
    description?: string;
    from?: string;
    to?: string;
    url?: string[];
    property?: string[];
}

export async function updateTransaction(
    bookId: string,
    transactionId: string,
    options: UpdateTransactionOptions
): Promise<Transaction> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const transaction = await book.getTransaction(transactionId);

    if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (options.date !== undefined) transaction.setDate(options.date);
    if (options.amount !== undefined) transaction.setAmount(options.amount);
    if (options.description !== undefined) transaction.setDescription(options.description);

    if (options.from !== undefined) {
        const creditAccount = await book.getAccount(options.from);
        if (creditAccount) transaction.setCreditAccount(creditAccount);
    }

    if (options.to !== undefined) {
        const debitAccount = await book.getAccount(options.to);
        if (debitAccount) transaction.setDebitAccount(debitAccount);
    }

    if (options.url !== undefined) {
        transaction.setUrls(options.url);
    }

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            if (value === '') {
                transaction.deleteProperty(key);
            } else {
                transaction.setProperty(key, value);
            }
        }
    }

    return transaction.update();
}
