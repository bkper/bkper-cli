import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { parseStdinItems } from '../../input/index.js';
import {
    listAccountsFormatted,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    batchCreateAccounts,
} from './index.js';

export function registerAccountCommands(program: Command): void {
    const accountCommand = program.command('account').description('Manage Accounts');

    accountCommand
        .command('list')
        .description('List all accounts in a book')
        .option('-b, --book <bookId>', 'Book ID')
        .action(options =>
            withAction('listing accounts', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const result = await listAccountsFormatted(options.book, format);
                renderListResult(result, format);
            })()
        );

    accountCommand
        .command('get <idOrName>')
        .description('Get an account by ID or name')
        .option('-b, --book <bookId>', 'Book ID')
        .action((idOrName: string, options) =>
            withAction('getting account', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const account = await getAccount(options.book, idOrName);
                renderItem(account.json(), format);
            })()
        );

    accountCommand
        .command('create')
        .description('Create a new account')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--name <name>', 'Account name')
        .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
        .option('--description <description>', 'Account description')
        .option('--groups <groups>', 'Comma-separated group names')
        .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
        .action(options =>
            withAction('creating account', async format => {
                const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

                if (stdinData && stdinData.items.length > 0) {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    await batchCreateAccounts(options.book, stdinData.items, options.property);
                } else if (stdinData && stdinData.items.length === 0) {
                    console.log(JSON.stringify([], null, 2));
                } else {
                    throwIfErrors(
                        validateRequiredOptions(options, [
                            { name: 'book', flag: '--book' },
                            { name: 'name', flag: '--name' },
                        ])
                    );
                    const account = await createAccount(options.book, {
                        name: options.name,
                        type: options.type,
                        description: options.description,
                        groups: options.groups
                            ? options.groups.split(',').map((g: string) => g.trim())
                            : undefined,
                        property: options.property,
                    });
                    renderItem(account.json(), format);
                }
            })()
        );

    accountCommand
        .command('update <idOrName>')
        .description('Update an account')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--name <name>', 'Account name')
        .option('--type <type>', 'Account type (ASSET, LIABILITY, INCOMING, OUTGOING)')
        .option('--archived <archived>', 'Archive status (true/false)')
        .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
        .action((idOrName: string, options) =>
            withAction('updating account', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const account = await updateAccount(options.book, idOrName, {
                    name: options.name,
                    type: options.type,
                    archived:
                        options.archived !== undefined ? options.archived === 'true' : undefined,
                    property: options.property,
                });
                renderItem(account.json(), format);
            })()
        );

    accountCommand
        .command('delete <idOrName>')
        .description('Delete an account')
        .option('-b, --book <bookId>', 'Book ID')
        .action((idOrName: string, options) =>
            withAction('deleting account', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const account = await deleteAccount(options.book, idOrName);
                renderItem(account.json(), format);
            })()
        );
}
