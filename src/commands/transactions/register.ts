import { Option, type Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty, collectRepeatable, parsePositiveInteger } from '../cli-helpers.js';
import { renderList, renderItem } from '../../render/index.js';
import { transactionToJson } from './transaction-json.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { parseStdinItems } from '../../input/index.js';
import {
    listTransactionsFormatted,
    getTransaction,
    createTransaction,
    updateTransaction,
    postTransaction,
    checkTransaction,
    uncheckTransaction,
    trashTransaction,
    untrashTransaction,
    mergeTransactions,
    batchCreateTransactions,
    batchUpdateTransactions,
    resolveCreateTransactionFilePath,
} from './index.js';

export function registerTransactionCommands(program: Command): void {
    const transactionCommand = program.command('transaction').description('Manage Transactions');

    transactionCommand
        .command('list')
        .description('List transactions in a book')
        .option('-b, --book <bookId>', 'Book ID')
        .option('-q, --query <query>', 'Search query')
        .option(
            '--limit <limit>',
            'Fetch one page with up to this many transactions',
            parsePositiveInteger
        )
        .option('--cursor <cursor>', 'Cursor for fetching the next page')
        .addOption(
            new Option('-p, --properties', 'No-op: properties are always included').hideHelp()
        )
        .action(options =>
            withAction('listing transactions', async () => {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'query', flag: '--query' },
                    ])
                );
                const result = await listTransactionsFormatted(options.book, {
                    query: options.query,
                    limit: options.limit,
                    cursor: options.cursor,
                });
                renderList(result);
            })()
        );

    transactionCommand
        .command('get <transactionId>')
        .description('Get a transaction by ID')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('getting transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await getTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

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
        .option('--file <path>', 'Attach a local file (single-create only)', collectRepeatable)
        .option(
            '-p, --property <key=value>',
            'Set a property (repeatable, empty value deletes)',
            collectProperty
        )
        .action(options =>
            withAction('creating transaction', async () => {
                const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;
                const filePath = resolveCreateTransactionFilePath(
                    options.file,
                    stdinData !== null
                );

                if (stdinData && stdinData.items.length > 0) {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    await batchCreateTransactions(options.book, stdinData.items, options.property);
                } else if (stdinData && stdinData.items.length === 0) {
                    renderList({ items: [] });
                } else {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    const transaction = await createTransaction(options.book, {
                        date: options.date,
                        amount: options.amount,
                        description: options.description,
                        from: options.from,
                        to: options.to,
                        url: options.url,
                        remoteId: options.remoteId,
                        property: options.property,
                        file: filePath,
                    });
                    renderItem(await transactionToJson(transaction));
                }
            })()
        );

    transactionCommand
        .command('post <transactionId>')
        .description('Post a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('posting transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await postTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

    transactionCommand
        .command('update [transactionId]')
        .description('Update a transaction (or batch update via stdin)')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--date <date>', 'Transaction date')
        .option('--amount <amount>', 'Transaction amount')
        .option('--description <description>', 'Transaction description')
        .option('--from <from>', 'Credit account (source)')
        .option('--to <to>', 'Debit account (destination)')
        .option('--url <url>', 'URL (repeatable, replaces all)', collectProperty)
        .option('--update-checked', 'Also update checked transactions')
        .option(
            '-p, --property <key=value>',
            'Set a property (repeatable, empty value deletes)',
            collectProperty
        )
        .action((transactionId: string | undefined, options) =>
            withAction('updating transaction', async () => {
                const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

                if (stdinData && stdinData.items.length > 0) {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    await batchUpdateTransactions(
                        options.book,
                        stdinData.items,
                        options.property,
                        options.updateChecked
                    );
                } else if (stdinData && stdinData.items.length === 0) {
                    renderList({ items: [] });
                } else {
                    if (!transactionId) {
                        throw new Error('Transaction ID is required when not using stdin');
                    }
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    const transaction = await updateTransaction(options.book, transactionId, {
                        date: options.date,
                        amount: options.amount,
                        description: options.description,
                        from: options.from,
                        to: options.to,
                        url: options.url,
                        property: options.property,
                    });
                    renderItem(await transactionToJson(transaction));
                }
            })()
        );

    transactionCommand
        .command('check <transactionId>')
        .description('Check a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('checking transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await checkTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

    transactionCommand
        .command('uncheck <transactionId>')
        .description('Uncheck a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('unchecking transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await uncheckTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

    transactionCommand
        .command('trash <transactionId>')
        .description('Trash a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('trashing transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await trashTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

    transactionCommand
        .command('untrash <transactionId>')
        .description('Restore a transaction from the trash')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('restoring transaction', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await untrashTransaction(options.book, transactionId);
                renderItem(await transactionToJson(transaction));
            })()
        );

    transactionCommand
        .command('merge <transactionId1> <transactionId2>')
        .description('Merge two transactions')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId1: string, transactionId2: string, options) =>
            withAction('merging transactions', async () => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await mergeTransactions(
                    options.book,
                    transactionId1,
                    transactionId2
                );
                renderItem(await transactionToJson(transaction));
            })()
        );
}
