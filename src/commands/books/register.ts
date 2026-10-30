import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderList, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { listBooksFormatted, getBook, createBook, copyBook, updateBook } from './index.js';
import { cloneBookContext } from '../context/book-context.js';
import type { PullOutcome } from '../context/user-context.js';

const CLONE_MESSAGES: Record<PullOutcome, (dir: string) => string> = {
    synced: dir =>
        `Cloned the Book's agent context into ${dir}. Run your agent there to use it; a push publishes to everyone who can view the Book.`,
    unpublished: dir =>
        `${dir} is ready: nothing was published for this Book yet. Add AGENTS.md or .agents/skills, commit and push to share them with everyone who can view the Book (editors only).`,
    unpushed: dir => `${dir} has changes not pushed.`,
    failed: dir =>
        `Could not fetch the Book's agent context into ${dir}. Check your connection, then run git pull there.`,
};

export function registerBookCommands(program: Command): void {
    const bookCommand = program.command('book').description('Manage Books');

    bookCommand
        .command('list')
        .description('List all books')
        .option('-q, --query <query>', 'Search query')
        .action(options =>
            withAction('listing books', async () => {
                const result = await listBooksFormatted(options.query);
                renderList(result);
            })()
        );

    bookCommand
        .command('get <bookId>')
        .description('Get a book by ID')
        .action((bookId: string) =>
            withAction('getting book', async () => {
                const book = await getBook(bookId);
                renderItem(book.json());
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
            withAction('creating book', async () => {
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
                renderItem(book.json());
            })()
        );

    bookCommand
        .command('clone <bookId> [folder]')
        .description(
            "Clone a Book's agent context (AGENTS.md and skills) into a new folder, named after the Book by default; run an agent there"
        )
        .action((bookId: string, folder: string | undefined) =>
            withAction('cloning the Book agent context', async () => {
                const { dir, outcome } = await cloneBookContext({
                    bookId,
                    folder,
                    bookName: async id => (await getBook(id)).getName() ?? '',
                });
                console.log(CLONE_MESSAGES[outcome](dir));
                if (outcome === 'failed') process.exit(1);
            })()
        );

    bookCommand
        .command('copy <bookId>')
        .description('Copy a book')
        .option('--name <name>', 'Name for the copied book')
        .option('--transactions', 'Copy transactions (source book owner only)')
        .option('--from-date <date>', 'Copy transactions from this date (YYYY-MM-DD)')
        .action((bookId: string, options) =>
            withAction('copying book', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
                const book = await copyBook(bookId, {
                    name: options.name,
                    transactions: options.transactions,
                    fromDate: options.fromDate,
                });
                renderItem(book.json());
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
            withAction('updating book', async () => {
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
                renderItem(book.json());
            })()
        );
}
