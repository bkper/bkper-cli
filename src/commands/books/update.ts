import { getBkperInstance } from '../../bkper-factory.js';
import { Book, DecimalSeparator, Period } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface UpdateBookOptions {
    name?: string;
    fractionDigits?: number;
    datePattern?: string;
    decimalSeparator?: 'DOT' | 'COMMA';
    timeZone?: string;
    lockDate?: string;
    closingDate?: string;
    period?: 'MONTH' | 'QUARTER' | 'YEAR';
    property?: string[];
}

export async function updateBook(bookId: string, options: UpdateBookOptions): Promise<Book> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    if (options.name !== undefined) book.setName(options.name);
    if (options.fractionDigits !== undefined) book.setFractionDigits(options.fractionDigits);
    if (options.datePattern !== undefined) book.setDatePattern(options.datePattern);
    if (options.decimalSeparator !== undefined)
        book.setDecimalSeparator(options.decimalSeparator as DecimalSeparator);
    if (options.timeZone !== undefined) book.setTimeZone(options.timeZone);
    if (options.lockDate !== undefined) book.setLockDate(options.lockDate);
    if (options.closingDate !== undefined) book.setClosingDate(options.closingDate);
    if (options.period !== undefined) book.setPeriod(options.period as Period);

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            if (value === '') {
                book.deleteProperty(key);
            } else {
                book.setProperty(key, value);
            }
        }
    }

    return book.update();
}
