import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { listBooksFormatted, getBook, createBook, updateBook } from './index.js';

export function registerBookCommands(program: Command): void {
    const bookCommand = program.command('book').description('Manage Books');

    bookCommand
        .command('list')
        .description('List all books')
        .option('-q, --query <query>', 'Search query')
        .action(options =>
            withAction('listing books', async format => {
                const result = await listBooksFormatted(options.query, format);
                renderListResult(result, format);
            })()
        );

    bookCommand
        .command('get <bookId>')
        .description('Get a book by ID')
        .action((bookId: string) =>
            withAction('getting book', async format => {
                const book = await getBook(bookId);
                renderItem(book.json(), format);
            })()
        );

    bookCommand
        .command('create')
        .description('Create a new book')
        .option('--name <name>', 'Book name')
        .option('--fraction-digits <digits>', 'Number of decimal places (0-8)', parseInt)
        .option(
            '--date-pattern <pattern>',
            'Date format pattern (dd/MM/yyyy, MM/dd/yyyy, or yyyy/MM/dd)'
        )
        .option('--decimal-separator <separator>', 'Decimal separator (DOT or COMMA)')
        .option('--time-zone <timezone>', 'IANA time zone (e.g. America/New_York, UTC)')
        .option('--period <period>', 'Period (MONTH, QUARTER, or YEAR)')
        .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
        .action(options =>
            withAction('creating book', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
                const book = await createBook({
                    name: options.name,
                    fractionDigits: options.fractionDigits,
                    datePattern: options.datePattern,
                    decimalSeparator: options.decimalSeparator,
                    timeZone: options.timeZone,
                    period: options.period,
                    property: options.property,
                });
                renderItem(book.json(), format);
            })()
        );

    bookCommand
        .command('update <bookId>')
        .description('Update a book')
        .option('--name <name>', 'Book name')
        .option('--fraction-digits <digits>', 'Number of decimal places (0-8)', parseInt)
        .option(
            '--date-pattern <pattern>',
            'Date format pattern (dd/MM/yyyy, MM/dd/yyyy, or yyyy/MM/dd)'
        )
        .option('--decimal-separator <separator>', 'Decimal separator (DOT or COMMA)')
        .option('--time-zone <timezone>', 'IANA time zone (e.g. America/New_York, UTC)')
        .option('--lock-date <date>', 'Lock date in ISO format (yyyy-MM-dd)')
        .option('--closing-date <date>', 'Closing date in ISO format (yyyy-MM-dd)')
        .option('--period <period>', 'Period (MONTH, QUARTER, or YEAR)')
        .option(
            '-p, --property <key=value>',
            'Set a property (repeatable, empty value deletes)',
            collectProperty
        )
        .action((bookId: string, options) =>
            withAction('updating book', async format => {
                const book = await updateBook(bookId, {
                    name: options.name,
                    fractionDigits: options.fractionDigits,
                    datePattern: options.datePattern,
                    decimalSeparator: options.decimalSeparator,
                    timeZone: options.timeZone,
                    lockDate: options.lockDate,
                    closingDate: options.closingDate,
                    period: options.period,
                    property: options.property,
                });
                renderItem(book.json(), format);
            })()
        );
}
