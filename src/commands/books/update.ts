import { getBkperInstance } from '../../bkper-factory.js';
import { DecimalSeparator, Period } from 'bkper-js';

export interface UpdateBookOptions {
    name?: string;
    fractionDigits?: number;
    datePattern?: string;
    decimalSeparator?: 'DOT' | 'COMMA';
    timeZone?: string;
    lockDate?: string;
    closingDate?: string;
    period?: 'MONTH' | 'QUARTER' | 'YEAR';
    properties?: Record<string, string>;
}

export async function updateBook(bookId: string, options: UpdateBookOptions): Promise<bkper.Book> {
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
    if (options.properties !== undefined) book.setProperties(options.properties);

    const updated = await book.update();
    return updated.json();
}
