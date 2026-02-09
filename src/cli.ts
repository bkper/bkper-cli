#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program } from 'commander';
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
} from './commands/apps/index.js';
import { listBooks, getBook, updateBook } from './commands/books/index.js';
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
    createTransactions,
    postTransaction,
    checkTransaction,
    trashTransaction,
    mergeTransactions,
} from './commands/transactions/index.js';
import { getBalances } from './commands/balances/index.js';

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

            if (apps.length === 0) {
                console.log('No apps found.');
                return;
            }

            // Table-style output
            console.log('\nApps:\n');
            console.log('ID'.padEnd(25) + 'Name'.padEnd(30) + 'Published');
            console.log('-'.repeat(65));

            for (const app of apps) {
                const id = (app.id || '').padEnd(25);
                const name = (app.name || '').padEnd(30);
                const published = app.published ? 'Yes' : 'No';
                console.log(`${id}${name}${published}`);
            }

            console.log(`\nTotal: ${apps.length} app(s)`);
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
    .option('--dev', 'Deploy to development environment')
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
    .option('--dev', 'Remove from development environment')
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
    .action(async options => {
        try {
            setupBkper();
            await dev({
                clientPort: parseInt(options.clientPort, 10),
                serverPort: parseInt(options.serverPort, 10),
                eventsPort: parseInt(options.eventsPort, 10),
                web: options.web,
                events: options.events,
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
    .option('--dev', 'Set in development environment')
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
    .option('--dev', 'List from development environment')
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
    .option('--dev', 'Delete from development environment')
    .action(async (name: string, options) => {
        try {
            await secretsDelete(name, options);
        } catch (err) {
            console.error('Error deleting secret:', err);
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
            const result = await listBooks(options.query);
            console.log(JSON.stringify(result, null, 2));
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
            const result = await getBook(bookId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error getting book:', err);
            process.exit(1);
        }
    });

bookCommand
    .command('update <bookId>')
    .description('Update a book')
    .option('--name <name>', 'Book name')
    .option('--fraction-digits <digits>', 'Number of decimal places', parseInt)
    .option('--date-pattern <pattern>', 'Date format pattern')
    .option('--decimal-separator <separator>', 'Decimal separator (DOT or COMMA)')
    .option('--time-zone <timezone>', 'Time zone')
    .option('--lock-date <date>', 'Lock date')
    .option('--closing-date <date>', 'Closing date')
    .option('--period <period>', 'Period (MONTH, QUARTER, or YEAR)')
    .option('--properties <json>', 'Properties as JSON object')
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const result = await updateBook(bookId, {
                name: options.name,
                fractionDigits: options.fractionDigits,
                datePattern: options.datePattern,
                decimalSeparator: options.decimalSeparator,
                timeZone: options.timeZone,
                lockDate: options.lockDate,
                closingDate: options.closingDate,
                period: options.period,
                properties: options.properties ? JSON.parse(options.properties) : undefined,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error updating book:', err);
            process.exit(1);
        }
    });

// 'account' command group
const accountCommand = program.command('account').description('Manage Accounts');

accountCommand
    .command('list <bookId>')
    .description('List all accounts in a book')
    .action(async (bookId: string) => {
        try {
            setupBkper();
            const result = await listAccounts(bookId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error listing accounts:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('get <bookId> <idOrName>')
    .description('Get an account by ID or name')
    .action(async (bookId: string, idOrName: string) => {
        try {
            setupBkper();
            const result = await getAccount(bookId, idOrName);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error getting account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('create <bookId>')
    .description('Create a new account')
    .requiredOption('--name <name>', 'Account name')
    .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
    .option('--description <description>', 'Account description')
    .option('--groups <groups>', 'Comma-separated group names')
    .option('--properties <json>', 'Properties as JSON object')
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const result = await createAccount(bookId, {
                name: options.name,
                type: options.type,
                description: options.description,
                groups: options.groups
                    ? options.groups.split(',').map((g: string) => g.trim())
                    : undefined,
                properties: options.properties ? JSON.parse(options.properties) : undefined,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error creating account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('update <bookId> <idOrName>')
    .description('Update an account')
    .option('--name <name>', 'Account name')
    .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
    .option('--archived <archived>', 'Archive status (true/false)')
    .option('--properties <json>', 'Properties as JSON object')
    .action(async (bookId: string, idOrName: string, options) => {
        try {
            setupBkper();
            const result = await updateAccount(bookId, idOrName, {
                name: options.name,
                type: options.type,
                archived: options.archived !== undefined ? options.archived === 'true' : undefined,
                properties: options.properties ? JSON.parse(options.properties) : undefined,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error updating account:', err);
            process.exit(1);
        }
    });

accountCommand
    .command('delete <bookId> <idOrName>')
    .description('Delete an account')
    .action(async (bookId: string, idOrName: string) => {
        try {
            setupBkper();
            const result = await deleteAccount(bookId, idOrName);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error deleting account:', err);
            process.exit(1);
        }
    });

// 'group' command group
const groupCommand = program.command('group').description('Manage Groups');

groupCommand
    .command('list <bookId>')
    .description('List all groups in a book')
    .action(async (bookId: string) => {
        try {
            setupBkper();
            const result = await listGroups(bookId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error listing groups:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('get <bookId> <idOrName>')
    .description('Get a group by ID or name')
    .action(async (bookId: string, idOrName: string) => {
        try {
            setupBkper();
            const result = await getGroup(bookId, idOrName);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error getting group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('create <bookId>')
    .description('Create a new group')
    .requiredOption('--name <name>', 'Group name')
    .option('--parent <parent>', 'Parent group name or ID')
    .option('--hidden', 'Hide the group')
    .option('--properties <json>', 'Properties as JSON object')
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const result = await createGroup(bookId, {
                name: options.name,
                parent: options.parent,
                hidden: options.hidden,
                properties: options.properties ? JSON.parse(options.properties) : undefined,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error creating group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('update <bookId> <idOrName>')
    .description('Update a group')
    .option('--name <name>', 'Group name')
    .option('--hidden <hidden>', 'Hide status (true/false)')
    .option('--properties <json>', 'Properties as JSON object')
    .action(async (bookId: string, idOrName: string, options) => {
        try {
            setupBkper();
            const result = await updateGroup(bookId, idOrName, {
                name: options.name,
                hidden: options.hidden !== undefined ? options.hidden === 'true' : undefined,
                properties: options.properties ? JSON.parse(options.properties) : undefined,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error updating group:', err);
            process.exit(1);
        }
    });

groupCommand
    .command('delete <bookId> <idOrName>')
    .description('Delete a group')
    .action(async (bookId: string, idOrName: string) => {
        try {
            setupBkper();
            const result = await deleteGroup(bookId, idOrName);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error deleting group:', err);
            process.exit(1);
        }
    });

// 'transaction' command group
const transactionCommand = program.command('transaction').description('Manage Transactions');

transactionCommand
    .command('list <bookId>')
    .description('List transactions in a book')
    .requiredOption('-q, --query <query>', 'Search query')
    .option('-l, --limit <limit>', 'Maximum number of results', parseInt)
    .option('-c, --cursor <cursor>', 'Pagination cursor')
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const result = await listTransactions(bookId, {
                query: options.query,
                limit: options.limit,
                cursor: options.cursor,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error listing transactions:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('create <bookId>')
    .description('Create transactions (batch)')
    .requiredOption('--transactions <json>', 'Transaction data as JSON array')
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const inputs = JSON.parse(options.transactions);
            const result = await createTransactions(bookId, inputs);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error creating transactions:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('post <bookId> <transactionId>')
    .description('Post a transaction')
    .action(async (bookId: string, transactionId: string) => {
        try {
            setupBkper();
            const result = await postTransaction(bookId, transactionId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error posting transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('check <bookId> <transactionId>')
    .description('Check a transaction')
    .action(async (bookId: string, transactionId: string) => {
        try {
            setupBkper();
            const result = await checkTransaction(bookId, transactionId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error checking transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('trash <bookId> <transactionId>')
    .description('Trash a transaction')
    .action(async (bookId: string, transactionId: string) => {
        try {
            setupBkper();
            const result = await trashTransaction(bookId, transactionId);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error trashing transaction:', err);
            process.exit(1);
        }
    });

transactionCommand
    .command('merge <bookId> <transactionId1> <transactionId2>')
    .description('Merge two transactions')
    .action(async (bookId: string, transactionId1: string, transactionId2: string) => {
        try {
            setupBkper();
            const result = await mergeTransactions(bookId, transactionId1, transactionId2);
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error merging transactions:', err);
            process.exit(1);
        }
    });

// 'balance' command group
const balanceCommand = program.command('balance').description('Manage Balances');

balanceCommand
    .command('get <bookId>')
    .description('Get balances report')
    .requiredOption('-q, --query <query>', 'Balances query')
    .option('--raw', 'Include raw data table')
    .option('--expanded <level>', 'Expand groups to specified depth', parseInt)
    .action(async (bookId: string, options) => {
        try {
            setupBkper();
            const result = await getBalances(bookId, {
                query: options.query,
                raw: options.raw,
                expanded: options.expanded,
            });
            console.log(JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error getting balances:', err);
            process.exit(1);
        }
    });

program.parse(process.argv);
