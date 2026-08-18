import { Book } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/** Options for copying a Bkper book. */
export interface CopyBookOptions {
    name: string;
    transactions?: boolean;
    fromDate?: string;
}

/**
 * Copies a book, optionally including transactions from an ISO date.
 *
 * @param bookId - The source book ID
 * @param options - Copy configuration
 * @returns The copied book
 */
export async function copyBook(bookId: string, options: CopyBookOptions): Promise<Book> {
    if (options.fromDate !== undefined && !options.transactions) {
        throw new Error('--from-date requires --transactions');
    }

    const fromDate = parseFromDate(options.fromDate);
    const bkper = getBkperInstance();
    const sourceBook = await bkper.getBook(bookId);
    return sourceBook.copy(options.name, options.transactions ?? false, fromDate);
}

function parseFromDate(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        ) {
            return year * 10000 + month * 100 + day;
        }
    }

    throw new Error(
        `Invalid --from-date: ${value}. Expected a valid date in YYYY-MM-DD format`
    );
}
