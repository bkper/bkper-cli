import { getBkperInstance } from '../../bkper-factory.js';
import { Transaction } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { throwIfErrors } from '../../utils/validation.js';

/**
 * Options for updating an existing transaction. All fields are optional.
 */
export interface UpdateTransactionOptions {
    date?: string;
    amount?: string | number;
    description?: string;
    from?: string;
    to?: string;
    url?: string[];
    property?: string[];
}

/**
 * Updates an existing transaction with the provided fields.
 *
 * @param bookId - The book ID containing the transaction
 * @param transactionId - The ID of the transaction to update
 * @param options - Fields to update (only provided fields are changed)
 * @returns The updated transaction
 */
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

    const errors: string[] = [];

    if (options.date !== undefined) transaction.setDate(options.date);
    if (options.amount !== undefined) transaction.setAmount(options.amount);
    if (options.description !== undefined) transaction.setDescription(options.description);

    if (options.from !== undefined) {
        const creditAccount = await book.getAccount(options.from);
        if (creditAccount) {
            transaction.setCreditAccount(creditAccount);
        } else {
            errors.push(`Credit account (--from) not found: ${options.from}`);
        }
    }

    if (options.to !== undefined) {
        const debitAccount = await book.getAccount(options.to);
        if (debitAccount) {
            transaction.setDebitAccount(debitAccount);
        } else {
            errors.push(`Debit account (--to) not found: ${options.to}`);
        }
    }

    if (options.url !== undefined) {
        transaction.setUrls(options.url);
    }

    if (options.property) {
        for (const raw of options.property) {
            try {
                const [key, value] = parsePropertyFlag(raw);
                if (value === '') {
                    transaction.deleteProperty(key);
                } else {
                    transaction.setProperty(key, value);
                }
            } catch (err: unknown) {
                errors.push((err as Error).message);
            }
        }
    }

    throwIfErrors(errors);

    return transaction.update();
}
