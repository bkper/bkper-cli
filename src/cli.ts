#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program } from 'commander';
import { login, logout } from './auth/local-auth-service.js';
import { setupBkper } from './bkper-factory.js';
import {
    listAppsFormatted,
    syncApp,
    deployApp,
    undeployApp,
    statusApp,
    initApp,
    secretsPut,
    secretsList,
    secretsDelete,
    dev,
    build,
    DevOptions,
    installApp,
    uninstallApp,
} from './commands/apps/index.js';
import { listBooksFormatted, getBook, createBook, updateBook } from './commands/books/index.js';
import {
    listAccountsFormatted,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    batchCreateAccounts,
} from './commands/accounts/index.js';
import {
    listGroupsFormatted,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    batchCreateGroups,
} from './commands/groups/index.js';
import {
    listTransactionsFormatted,
    createTransaction,
    updateTransaction,
    postTransaction,
    checkTransaction,
    trashTransaction,
    mergeTransactions,
    batchCreateTransactions,
} from './commands/transactions/index.js';
import { listBalancesMatrix } from './commands/balances/index.js';
import {
    listCollectionsFormatted,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
} from './commands/collections/index.js';
import { renderListResult, renderTable, renderItem } from './render/index.js';
import type { OutputFormat } from './render/output.js';
import { validateRequiredOptions, throwIfErrors } from './utils/validation.js';
import { parseStdinItems } from './input/index.js';

function collectProperty(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

function collectBook(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

// Global --format option with --json as silent alias
program.option('--format <format>', 'Output format: table, json, or csv', 'table');
program.option('--json', 'Output as JSON (alias for --format json)');

/**
 * Returns the active output format, considering both --format and --json flags.
 * --json acts as a silent alias for --format json.
 */
function getFormat(): OutputFormat {
    const opts = program.opts();
    if (opts.json === true) {
        return 'json';
    }
    const format = opts.format as string;
    if (format === 'json' || format === 'csv') {
        return format;
    }
    return 'table';
}

// =============================================================================
// Auth
// =============================================================================

program
    .command('login')
    .description('Login Bkper')
    .action(async () => {
        await login();
    });

program
    .command('logout')
    .description('Logout Bkper')
    .action(() => {
        logout();
    });

// =============================================================================
// App
// =============================================================================

const appCommand = program.command('app').description('Manage Bkper Apps');

appCommand
    .command('init <name>')
    .description('Create a new Bkper app from template')
    .action(async (name: string) => {
        try {
            await initApp(name);
        } catch (err) {
            console.error('Error initializing app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('list')
    .description('List all apps you have access to')
    .action(async () => {
        try {
            setupBkper();
            const result = await listAppsFormatted(getFormat());
            renderListResult(result, getFormat());
        } catch (err) {
            console.error('Error listing apps:', err);
            process.exit(1);
        }
    });

appCommand
    .command('sync')
    .description('Sync app config to Bkper (creates if new, updates if exists)')
    .action(async () => {
        try {
            setupBkper();
            const result = await syncApp();
            console.log(`Synced ${result.id} (${result.action})`);
        } catch (err) {
            console.error('Error syncing app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('deploy')
    .description('Deploy app to Bkper Platform')
    .option('-p, --preview', 'Deploy to preview environment')
    .option('--events', 'Deploy events handler instead of web handler')
    .action(async options => {
        try {
            await deployApp(options);
        } catch (err) {
            console.error('Error deploying app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('undeploy')
    .description('Remove app from Bkper Platform')
    .option('-p, --preview', 'Remove from preview environment')
    .option('--events', 'Remove events handler instead of web handler')
    .option('--delete-data', 'Permanently delete all associated data (requires confirmation)')
    .option('--force', 'Skip confirmation prompts (use with --delete-data for automation)')
    .action(async options => {
        try {
            await undeployApp(options);
        } catch (err) {
            console.error('Error undeploying app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('status')
    .description('Show deployment status for all handlers')
    .action(async () => {
        try {
            await statusApp();
        } catch (err) {
            console.error('Error getting app status:', err);
            process.exit(1);
        }
    });

appCommand
    .command('dev')
    .description('Start the development server')
    .option('--cp, --client-port <port>', 'Client dev server port', '5173')
    .option('--sp, --server-port <port>', 'Server simulation port', '8787')
    .option('--ep, --events-port <port>', 'Events handler port', '8791')
    .option('-w, --web', 'Run only the web handler')
    .option('-e, --events', 'Run only the events handler')
    .option('--no-open', 'Do not open browser on startup')
    .action(async options => {
        try {
            setupBkper();
            await dev({
                clientPort: parseInt(options.clientPort, 10),
                serverPort: parseInt(options.serverPort, 10),
                eventsPort: parseInt(options.eventsPort, 10),
                web: options.web,
                events: options.events,
                open: options.open,
            });
        } catch (err) {
            console.error('Error starting dev server:', err);
            process.exit(1);
        }
    });

appCommand
    .command('build')
    .description('Build all configured handlers for deployment')
    .action(async () => {
        try {
            await build();
        } catch (err) {
            console.error('Error building app:', err);
            process.exit(1);
        }
    });

const secretsCommand = appCommand.command('secrets').description('Manage app secrets');

secretsCommand
    .command('put <name>')
    .description('Set a secret value')
    .option('-p, --preview', 'Set in preview environment')
    .action(async (name: string, options) => {
        try {
            await secretsPut(name, options);
        } catch (err) {
            console.error('Error setting secret:', err);
            process.exit(1);
        }
    });

secretsCommand
    .command('list')
    .description('List all secrets')
    .option('-p, --preview', 'List from preview environment')
    .action(async options => {
        try {
            await secretsList(options);
        } catch (err) {
            console.error('Error listing secrets:', err);
            process.exit(1);
        }
    });

secretsCommand
    .command('delete <name>')
    .description('Delete a secret')
    .option('-p, --preview', 'Delete from preview environment')
    .action(async (name: string, options) => {
        try {
            await secretsDelete(name, options);
        } catch (err) {
            console.error('Error deleting secret:', err);
            process.exit(1);
        }
    });

appCommand
    .command('install <appId>')
    .description('Install an app into a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (appId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const integration = await installApp(options.book, appId);
            renderItem(integration.json(), getFormat());
        } catch (err) {
            console.error('Error installing app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('uninstall <appId>')
    .description('Uninstall an app from a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (appId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const integration = await uninstallApp(options.book, appId);
            renderItem(integration.json(), getFormat());
        } catch (err) {
            console.error('Error uninstalling app:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Book
// =============================================================================

const bookCommand = program.command('book').description('Manage Books');

bookCommand
    .command('list')
    .description('List all books')
    .option('-q, --query <query>', 'Search query')
    .action(async options => {
        try {
            setupBkper();
            const format = getFormat();
            const result = await listBooksFormatted(options.query, format);
            renderListResult(result, format);
        } catch (err) {
            console.error('Error listing books:', err);
            process.exit(1);
        }
    });

bookCommand
    .command('get <bookId>')
    .description('Get a book by ID')
    .action(async (bookId: string) => {
        try {
            setupBkper();
            const book = await getBook(bookId);
            renderItem(book.json(), getFormat());
        } catch (err) {
            console.error('Error getting book:', err);
            process.exit(1);
        }
    });

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
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
            setupBkper();
            const book = await createBook({
                name: options.name,
                fractionDigits: options.fractionDigits,
                datePattern: options.datePattern,
                decimalSeparator: options.decimalSeparator,
                timeZone: options.timeZone,
                period: options.period,
                property: options.property,
            });
            renderItem(book.json(), getFormat());
        } catch (err) {
            console.error('Error creating book:', err);
            process.exit(1);
        }
    });

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
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
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
            renderItem(book.json(), getFormat());
        } catch (err) {
            console.error('Error updating book:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Account
// =============================================================================

const accountCommand = program.command('account').description('Manage Accounts');

accountCommand
    .command('list')
    .description('List all accounts in a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const format = getFormat();
            const result = await listAccountsFormatted(options.book, format);
            renderListResult(result, format);
        } catch (err) {
            console.error('Error listing accounts:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('get <idOrName>')
    .description('Get an account by ID or name')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const account = await getAccount(options.book, idOrName);
            renderItem(account.json(), getFormat());
        } catch (err) {
            console.error('Error getting account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('create')
    .description('Create a new account')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--name <name>', 'Account name')
    .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
    .option('--description <description>', 'Account description')
    .option('--groups <groups>', 'Comma-separated group names')
    .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
    .action(async options => {
        try {
            const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

            if (stdinData && stdinData.items.length > 0) {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                setupBkper();
                await batchCreateAccounts(options.book, stdinData.items, options.property);
            } else {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'name', flag: '--name' },
                    ])
                );
                setupBkper();
                const account = await createAccount(options.book, {
                    name: options.name,
                    type: options.type,
                    description: options.description,
                    groups: options.groups
                        ? options.groups.split(',').map((g: string) => g.trim())
                        : undefined,
                    property: options.property,
                });
                renderItem(account.json(), getFormat());
            }
        } catch (err) {
            console.error('Error creating account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('update <idOrName>')
    .description('Update an account')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--name <name>', 'Account name')
    .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
    .option('--archived <archived>', 'Archive status (true/false)')
    .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const account = await updateAccount(options.book, idOrName, {
                name: options.name,
                type: options.type,
                archived: options.archived !== undefined ? options.archived === 'true' : undefined,
                property: options.property,
            });
            renderItem(account.json(), getFormat());
        } catch (err) {
            console.error('Error updating account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('delete <idOrName>')
    .description('Delete an account')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const account = await deleteAccount(options.book, idOrName);
            renderItem(account.json(), getFormat());
        } catch (err) {
            console.error('Error deleting account:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Group
// =============================================================================

const groupCommand = program.command('group').description('Manage Groups');

groupCommand
    .command('list')
    .description('List all groups in a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const format = getFormat();
            const result = await listGroupsFormatted(options.book, format);
            renderListResult(result, format);
        } catch (err) {
            console.error('Error listing groups:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('get <idOrName>')
    .description('Get a group by ID or name')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const group = await getGroup(options.book, idOrName);
            renderItem(group.json(), getFormat());
        } catch (err) {
            console.error('Error getting group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('create')
    .description('Create a new group')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--name <name>', 'Group name')
    .option('--parent <parent>', 'Parent group name or ID')
    .option('--hidden', 'Hide the group')
    .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
    .action(async options => {
        try {
            const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

            if (stdinData && stdinData.items.length > 0) {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                setupBkper();
                await batchCreateGroups(options.book, stdinData.items, options.property);
            } else {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'name', flag: '--name' },
                    ])
                );
                setupBkper();
                const group = await createGroup(options.book, {
                    name: options.name,
                    parent: options.parent,
                    hidden: options.hidden,
                    property: options.property,
                });
                renderItem(group.json(), getFormat());
            }
        } catch (err) {
            console.error('Error creating group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('update <idOrName>')
    .description('Update a group')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--name <name>', 'Group name')
    .option('--hidden <hidden>', 'Hide status (true/false)')
    .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const group = await updateGroup(options.book, idOrName, {
                name: options.name,
                hidden: options.hidden !== undefined ? options.hidden === 'true' : undefined,
                property: options.property,
            });
            renderItem(group.json(), getFormat());
        } catch (err) {
            console.error('Error updating group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('delete <idOrName>')
    .description('Delete a group')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (idOrName: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const group = await deleteGroup(options.book, idOrName);
            renderItem(group.json(), getFormat());
        } catch (err) {
            console.error('Error deleting group:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Transaction
// =============================================================================

const transactionCommand = program.command('transaction').description('Manage Transactions');

transactionCommand
    .command('list')
    .description('List transactions in a book')
    .option('-b, --book <bookId>', 'Book ID')
    .option('-q, --query <query>', 'Search query')
    .option('-l, --limit <limit>', 'Maximum number of results (1-1000)', parseInt)
    .option('-c, --cursor <cursor>', 'Pagination cursor')
    .option('-p, --properties', 'Include custom properties')
    .action(async options => {
        try {
            throwIfErrors(
                validateRequiredOptions(options, [
                    { name: 'book', flag: '--book' },
                    { name: 'query', flag: '--query' },
                ])
            );
            setupBkper();
            const format = getFormat();
            const result = await listTransactionsFormatted(
                options.book,
                {
                    query: options.query,
                    limit: options.limit,
                    cursor: options.cursor,
                    properties: options.properties,
                },
                format
            );
            renderListResult(result, format);
        } catch (err) {
            console.error('Error listing transactions:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('create')
    .description('Create a transaction')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--date <date>', 'Transaction date')
    .option('--amount <amount>', 'Transaction amount')
    .option('--description <description>', 'Transaction description')
    .option('--from <from>', 'Credit account (source)')
    .option('--to <to>', 'Debit account (destination)')
    .option('--url <url>', 'URL (repeatable)', collectProperty)
    .option('--remote-id <remoteId>', 'Remote ID (repeatable)', collectProperty)
    .option(
        '-p, --property <key=value>',
        'Set a property (repeatable, empty value deletes)',
        collectProperty
    )
    .action(async options => {
        try {
            const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

            if (stdinData && stdinData.items.length > 0) {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                setupBkper();
                await batchCreateTransactions(options.book, stdinData.items, options.property);
            } else {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'date', flag: '--date' },
                        { name: 'amount', flag: '--amount' },
                    ])
                );
                setupBkper();
                const transaction = await createTransaction(options.book, {
                    date: options.date,
                    amount: options.amount,
                    description: options.description,
                    from: options.from,
                    to: options.to,
                    url: options.url,
                    remoteId: options.remoteId,
                    property: options.property,
                });
                renderItem(transaction.json(), getFormat());
            }
        } catch (err) {
            console.error('Error creating transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('post <transactionId>')
    .description('Post a transaction')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (transactionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const transaction = await postTransaction(options.book, transactionId);
            renderItem(transaction.json(), getFormat());
        } catch (err) {
            console.error('Error posting transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('update <transactionId>')
    .description('Update a transaction')
    .option('-b, --book <bookId>', 'Book ID')
    .option('--date <date>', 'Transaction date')
    .option('--amount <amount>', 'Transaction amount')
    .option('--description <description>', 'Transaction description')
    .option('--from <from>', 'Credit account (source)')
    .option('--to <to>', 'Debit account (destination)')
    .option('--url <url>', 'URL (repeatable, replaces all)', collectProperty)
    .option(
        '-p, --property <key=value>',
        'Set a property (repeatable, empty value deletes)',
        collectProperty
    )
    .action(async (transactionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const transaction = await updateTransaction(options.book, transactionId, {
                date: options.date,
                amount: options.amount,
                description: options.description,
                from: options.from,
                to: options.to,
                url: options.url,
                property: options.property,
            });
            renderItem(transaction.json(), getFormat());
        } catch (err) {
            console.error('Error updating transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('check <transactionId>')
    .description('Check a transaction')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (transactionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const transaction = await checkTransaction(options.book, transactionId);
            renderItem(transaction.json(), getFormat());
        } catch (err) {
            console.error('Error checking transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('trash <transactionId>')
    .description('Trash a transaction')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (transactionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const transaction = await trashTransaction(options.book, transactionId);
            renderItem(transaction.json(), getFormat());
        } catch (err) {
            console.error('Error trashing transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('merge <transactionId1> <transactionId2>')
    .description('Merge two transactions')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async (transactionId1: string, transactionId2: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const format = getFormat();
            const result = await mergeTransactions(options.book, transactionId1, transactionId2);
            if (format === 'json' || format === 'csv') {
                console.log(
                    JSON.stringify(
                        {
                            mergedTransaction: result.mergedTransaction.json(),
                            revertedTransactionId: result.revertedTransactionId,
                            auditRecord: result.auditRecord,
                        },
                        null,
                        2
                    )
                );
            } else {
                renderItem(result.mergedTransaction.json(), 'table');
            }
        } catch (err) {
            console.error('Error merging transactions:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Balance
// =============================================================================

const balanceCommand = program.command('balance').description('Manage Balances');

balanceCommand
    .command('list')
    .description('List balances')
    .option('-b, --book <bookId>', 'Book ID')
    .option('-q, --query <query>', 'Balances query')
    .option('--expanded <level>', 'Expand groups to specified depth (0+)', parseInt)
    .action(async options => {
        try {
            throwIfErrors(
                validateRequiredOptions(options, [
                    { name: 'book', flag: '--book' },
                    { name: 'query', flag: '--query' },
                ])
            );
            setupBkper();
            const format = getFormat();
            const matrix = await listBalancesMatrix(options.book, {
                query: options.query,
                expanded: options.expanded,
                format,
            });
            renderTable(matrix, format);
        } catch (err) {
            console.error('Error listing balances:', err);
            process.exit(1);
        }
    });

// =============================================================================
// Collection
// =============================================================================

const collectionCommand = program.command('collection').description('Manage Collections');

collectionCommand
    .command('list')
    .description('List all collections')
    .action(async () => {
        try {
            setupBkper();
            const format = getFormat();
            const result = await listCollectionsFormatted(format);
            renderListResult(result, format);
        } catch (err) {
            console.error('Error listing collections:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('get <collectionId>')
    .description('Get a collection by ID')
    .action(async (collectionId: string) => {
        try {
            setupBkper();
            const collection = await getCollection(collectionId);
            renderItem(collection.json(), getFormat());
        } catch (err) {
            console.error('Error getting collection:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('create')
    .description('Create a new collection')
    .option('--name <name>', 'Collection name')
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'name', flag: '--name' }]));
            setupBkper();
            const collection = await createCollection({ name: options.name });
            renderItem(collection.json(), getFormat());
        } catch (err) {
            console.error('Error creating collection:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('update <collectionId>')
    .description('Update a collection')
    .option('--name <name>', 'Collection name')
    .action(async (collectionId: string, options) => {
        try {
            setupBkper();
            const collection = await updateCollection(collectionId, {
                name: options.name,
            });
            renderItem(collection.json(), getFormat());
        } catch (err) {
            console.error('Error updating collection:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('delete <collectionId>')
    .description('Delete a collection')
    .action(async (collectionId: string) => {
        try {
            setupBkper();
            await deleteCollection(collectionId);
            console.log(`Collection ${collectionId} deleted.`);
        } catch (err) {
            console.error('Error deleting collection:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('add-book <collectionId>')
    .description('Add books to a collection')
    .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
    .action(async (collectionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const format = getFormat();
            const books = await addBookToCollection(collectionId, options.book);
            if (format === 'json' || format === 'csv') {
                console.log(
                    JSON.stringify(
                        books.map(b => b.json()),
                        null,
                        2
                    )
                );
            } else {
                console.log(`Added ${options.book.length} book(s) to collection ${collectionId}.`);
            }
        } catch (err) {
            console.error('Error adding books to collection:', err);
            process.exit(1);
        }
    });

collectionCommand
    .command('remove-book <collectionId>')
    .description('Remove books from a collection')
    .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
    .action(async (collectionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const format = getFormat();
            const books = await removeBookFromCollection(collectionId, options.book);
            if (format === 'json' || format === 'csv') {
                console.log(
                    JSON.stringify(
                        books.map(b => b.json()),
                        null,
                        2
                    )
                );
            } else {
                console.log(
                    `Removed ${options.book.length} book(s) from collection ${collectionId}.`
                );
            }
        } catch (err) {
            console.error('Error removing books from collection:', err);
            process.exit(1);
        }
    });

program.parse(process.argv);
