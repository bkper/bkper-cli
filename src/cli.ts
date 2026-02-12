#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program } from 'commander';
import {
    AccountsDataTableBuilder,
    GroupsDataTableBuilder,
    TransactionsDataTableBuilder,
} from 'bkper-js';
import { login, logout } from './auth/local-auth-service.js';
import { setupBkper } from './bkper-factory.js';
import {
    listApps,
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
import { listBooks, getBook, createBook, updateBook } from './commands/books/index.js';
import {
    listAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
} from './commands/accounts/index.js';
import {
    listGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
} from './commands/groups/index.js';
import {
    listTransactions,
    createTransaction,
    updateTransaction,
    postTransaction,
    checkTransaction,
    trashTransaction,
    mergeTransactions,
} from './commands/transactions/index.js';
import { listBalancesMatrix } from './commands/balances/index.js';
import {
    listCollections,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
} from './commands/collections/index.js';
import { renderTable, renderItem } from './render/index.js';
import { validateRequiredOptions, throwIfErrors } from './utils/validation.js';

function collectProperty(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

// Global --json option
program.option('--json', 'Output as JSON');

function isJson(): boolean {
    return program.opts().json === true;
}

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

// 'app' command group (singular, modern pattern)
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
            const apps = await listApps();

            if (isJson()) {
                console.log(JSON.stringify(apps, null, 2));
                return;
            }

            if (apps.length === 0) {
                console.log('No results found.');
                return;
            }

            const matrix: unknown[][] = [['ID', 'Name', 'Published']];
            for (const app of apps) {
                matrix.push([app.id || '', app.name || '', app.published ? 'Yes' : 'No']);
            }

            renderTable(matrix, false);
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

// Development server command
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

// Build command
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

// Secrets subcommand
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
            renderItem(integration.json(), isJson());
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
            renderItem(integration.json(), isJson());
        } catch (err) {
            console.error('Error uninstalling app:', err);
            process.exit(1);
        }
    });

// 'book' command group
const bookCommand = program.command('book').description('Manage Books');

bookCommand
    .command('list')
    .description('List all books')
    .option('-q, --query <query>', 'Search query')
    .action(async options => {
        try {
            setupBkper();
            const books = await listBooks(options.query);
            if (isJson()) {
                console.log(
                    JSON.stringify(
                        books.map(b => b.json()),
                        null,
                        2
                    )
                );
            } else {
                if (books.length === 0) {
                    console.log('No results found.');
                    return;
                }
                books.sort((a, b) => {
                    const collA = a.getCollection()?.getName();
                    const collB = b.getCollection()?.getName();
                    if (collA && !collB) return -1;
                    if (!collA && collB) return 1;
                    let ret = (collA || '').localeCompare(collB || '');
                    if (ret === 0) {
                        ret = (a.getName() || '').localeCompare(b.getName() || '');
                    }
                    return ret;
                });
                const matrix: unknown[][] = [['Book Id', 'Name', 'Owner', 'Collection']];
                for (const book of books) {
                    matrix.push([
                        book.getId() || '',
                        book.getName() || '',
                        book.getOwnerName() || '',
                        book.getCollection()?.getName() || '',
                    ]);
                }
                renderTable(matrix, false);
            }
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
            renderItem(book.json(), isJson());
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
            renderItem(book.json(), isJson());
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
            renderItem(book.json(), isJson());
        } catch (err) {
            console.error('Error updating book:', err);
            process.exit(1);
        }
    });

// 'account' command group
const accountCommand = program.command('account').description('Manage Accounts');

accountCommand
    .command('list')
    .description('List all accounts in a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const bookId = options.book;
            const accounts = await listAccounts(bookId);
            if (isJson()) {
                console.log(
                    JSON.stringify(
                        accounts.map(a => a.json()),
                        null,
                        2
                    )
                );
            } else {
                const matrix = await new AccountsDataTableBuilder(accounts)
                    .ids(true)
                    .groups(true)
                    .build();
                renderTable(matrix, false);
            }
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
            const bookId = options.book;
            const account = await getAccount(bookId, idOrName);
            renderItem(account.json(), isJson());
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
            throwIfErrors(
                validateRequiredOptions(options, [
                    { name: 'book', flag: '--book' },
                    { name: 'name', flag: '--name' },
                ])
            );
            setupBkper();
            const bookId = options.book;
            const account = await createAccount(bookId, {
                name: options.name,
                type: options.type,
                description: options.description,
                groups: options.groups
                    ? options.groups.split(',').map((g: string) => g.trim())
                    : undefined,
                property: options.property,
            });
            renderItem(account.json(), isJson());
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
            const bookId = options.book;
            const account = await updateAccount(bookId, idOrName, {
                name: options.name,
                type: options.type,
                archived: options.archived !== undefined ? options.archived === 'true' : undefined,
                property: options.property,
            });
            renderItem(account.json(), isJson());
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
            const bookId = options.book;
            const account = await deleteAccount(bookId, idOrName);
            renderItem(account.json(), isJson());
        } catch (err) {
            console.error('Error deleting account:', err);
            process.exit(1);
        }
    });

// 'group' command group
const groupCommand = program.command('group').description('Manage Groups');

groupCommand
    .command('list')
    .description('List all groups in a book')
    .option('-b, --book <bookId>', 'Book ID')
    .action(async options => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const bookId = options.book;
            const groups = await listGroups(bookId);
            if (isJson()) {
                console.log(
                    JSON.stringify(
                        groups.map(g => g.json()),
                        null,
                        2
                    )
                );
            } else {
                const matrix = new GroupsDataTableBuilder(groups).ids(true).tree(true).build();
                renderTable(matrix, false);
            }
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
            const bookId = options.book;
            const group = await getGroup(bookId, idOrName);
            renderItem(group.json(), isJson());
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
            throwIfErrors(
                validateRequiredOptions(options, [
                    { name: 'book', flag: '--book' },
                    { name: 'name', flag: '--name' },
                ])
            );
            setupBkper();
            const bookId = options.book;
            const group = await createGroup(bookId, {
                name: options.name,
                parent: options.parent,
                hidden: options.hidden,
                property: options.property,
            });
            renderItem(group.json(), isJson());
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
            const bookId = options.book;
            const group = await updateGroup(bookId, idOrName, {
                name: options.name,
                hidden: options.hidden !== undefined ? options.hidden === 'true' : undefined,
                property: options.property,
            });
            renderItem(group.json(), isJson());
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
            const bookId = options.book;
            const group = await deleteGroup(bookId, idOrName);
            renderItem(group.json(), isJson());
        } catch (err) {
            console.error('Error deleting group:', err);
            process.exit(1);
        }
    });

// 'transaction' command group
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
            const bookId = options.book;
            const result = await listTransactions(bookId, {
                query: options.query,
                limit: options.limit,
                cursor: options.cursor,
            });
            if (isJson()) {
                console.log(
                    JSON.stringify(
                        {
                            items: result.items.map(tx => tx.json()),
                            cursor: result.cursor,
                        },
                        null,
                        2
                    )
                );
            } else {
                const builder = result.book
                    .createTransactionsDataTable(result.items, result.account)
                    .ids(true)
                    .formatDates(true)
                    .formatValues(true)
                    .recordedAt(false);
                if (options.properties) {
                    builder.properties(true);
                }
                const matrix = await builder.build();
                renderTable(matrix, false);
                if (result.cursor) {
                    console.log(`\nNext cursor: ${result.cursor}`);
                }
            }
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
            throwIfErrors(
                validateRequiredOptions(options, [
                    { name: 'book', flag: '--book' },
                    { name: 'date', flag: '--date' },
                    { name: 'amount', flag: '--amount' },
                ])
            );
            setupBkper();
            const bookId = options.book;
            const transaction = await createTransaction(bookId, {
                date: options.date,
                amount: options.amount,
                description: options.description,
                from: options.from,
                to: options.to,
                url: options.url,
                remoteId: options.remoteId,
                property: options.property,
            });
            renderItem(transaction.json(), isJson());
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
            const bookId = options.book;
            const transaction = await postTransaction(bookId, transactionId);
            renderItem(transaction.json(), isJson());
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
            const bookId = options.book;
            const transaction = await updateTransaction(bookId, transactionId, {
                date: options.date,
                amount: options.amount,
                description: options.description,
                from: options.from,
                to: options.to,
                url: options.url,
                property: options.property,
            });
            renderItem(transaction.json(), isJson());
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
            const bookId = options.book;
            const transaction = await checkTransaction(bookId, transactionId);
            renderItem(transaction.json(), isJson());
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
            const bookId = options.book;
            const transaction = await trashTransaction(bookId, transactionId);
            renderItem(transaction.json(), isJson());
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
            const bookId = options.book;
            const result = await mergeTransactions(bookId, transactionId1, transactionId2);
            if (isJson()) {
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
                renderItem(result.mergedTransaction.json(), false);
            }
        } catch (err) {
            console.error('Error merging transactions:', err);
            process.exit(1);
        }
    });

// 'balance' command group
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
            const bookId = options.book;
            const matrix = await listBalancesMatrix(bookId, {
                query: options.query,
                expanded: options.expanded,
            });
            renderTable(matrix, isJson());
        } catch (err) {
            console.error('Error listing balances:', err);
            process.exit(1);
        }
    });

// 'collection' command group
const collectionCommand = program.command('collection').description('Manage Collections');

collectionCommand
    .command('list')
    .description('List all collections')
    .action(async () => {
        try {
            setupBkper();
            const collections = await listCollections();
            if (isJson()) {
                console.log(
                    JSON.stringify(
                        collections.map(c => c.json()),
                        null,
                        2
                    )
                );
            } else {
                if (collections.length === 0) {
                    console.log('No collections found.');
                    return;
                }
                const matrix: unknown[][] = [['ID', 'Name', 'Books']];
                for (const col of collections) {
                    const books = col.getBooks();
                    matrix.push([col.getId() || '', col.getName() || '', books.length.toString()]);
                }
                renderTable(matrix, false);
            }
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
            renderItem(collection.json(), isJson());
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
            renderItem(collection.json(), isJson());
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
            renderItem(collection.json(), isJson());
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

function collectBook(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

collectionCommand
    .command('add-book <collectionId>')
    .description('Add books to a collection')
    .option('-b, --book <bookId>', 'Book ID (repeatable)', collectBook)
    .action(async (collectionId: string, options) => {
        try {
            throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
            setupBkper();
            const books = await addBookToCollection(collectionId, options.book);
            if (isJson()) {
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
            const books = await removeBookFromCollection(collectionId, options.book);
            if (isJson()) {
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
