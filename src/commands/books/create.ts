import { getBkperInstance } from '../../bkper-factory.js';
import { Book, DecimalSeparator, Period } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';

export interface CreateBookOptions {
    name: string;
    fractionDigits?: number;
    datePattern?: string;
    decimalSeparator?: 'DOT' | 'COMMA';
    timeZone?: string;
    period?: 'MONTH' | 'QUARTER' | 'YEAR';
    property?: string[];
}

export async function createBook(options: CreateBookOptions): Promise<Book> {
    const bkper = getBkperInstance();
    const book = new Book({ name: options.name }, bkper.getConfig());
    book.setName(options.name);

    if (options.fractionDigits !== undefined) book.setFractionDigits(options.fractionDigits);
    if (options.datePattern !== undefined) book.setDatePattern(options.datePattern);
    if (options.decimalSeparator !== undefined)
        book.setDecimalSeparator(options.decimalSeparator as DecimalSeparator);
    if (options.timeZone !== undefined) book.setTimeZone(options.timeZone);
    if (options.period !== undefined) book.setPeriod(options.period as Period);

    if (options.property) {
        for (const raw of options.property) {
            const [key, value] = parsePropertyFlag(raw);
            book.setProperty(key, value);
        }
    }

    return book.create();
}
