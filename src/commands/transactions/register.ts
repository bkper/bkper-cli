import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { parseStdinItems } from '../../input/index.js';
import {
    listTransactionsFormatted,
    createTransaction,
    updateTransaction,
    postTransaction,
    checkTransaction,
    trashTransaction,
    mergeTransactions,
    batchCreateTransactions,
} from './index.js';

export function registerTransactionCommands(program: Command): void {
    const transactionCommand = program.command('transaction').description('Manage Transactions');

    transactionCommand
        .command('list')
        .description('List transactions in a book')
        .option('-b, --book <bookId>', 'Book ID')
        .option('-q, --query <query>', 'Search query')
        .option('-p, --properties', 'Include custom properties')
        .action(options =>
            withAction('listing transactions', async format => {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'query', flag: '--query' },
                    ])
                );
                const result = await listTransactionsFormatted(
                    options.book,
                    {
                        query: options.query,
                        properties: options.properties,
                    },
                    format
                );
                renderListResult(result, format);
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
        .option(
            '-p, --property <key=value>',
            'Set a property (repeatable, empty value deletes)',
            collectProperty
        )
        .action(options =>
            withAction('creating transaction', async format => {
                const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

                if (stdinData && stdinData.items.length > 0) {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    await batchCreateTransactions(options.book, stdinData.items, options.property);
                } else if (stdinData && stdinData.items.length === 0) {
                    console.log(JSON.stringify([], null, 2));
                } else {
                    throwIfErrors(
                        validateRequiredOptions(options, [
                            { name: 'book', flag: '--book' },
                            { name: 'date', flag: '--date' },
                            { name: 'amount', flag: '--amount' },
                        ])
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
                    });
                    renderItem(transaction.json(), format);
                }
            })()
        );

    transactionCommand
        .command('post <transactionId>')
        .description('Post a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('posting transaction', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await postTransaction(options.book, transactionId);
                renderItem(transaction.json(), format);
            })()
        );

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
        .action((transactionId: string, options) =>
            withAction('updating transaction', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await updateTransaction(options.book, transactionId, {
                    date: options.date,
                    amount: options.amount,
                    description: options.description,
                    from: options.from,
                    to: options.to,
                    url: options.url,
                    property: options.property,
                });
                renderItem(transaction.json(), format);
            })()
        );

    transactionCommand
        .command('check <transactionId>')
        .description('Check a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('checking transaction', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await checkTransaction(options.book, transactionId);
                renderItem(transaction.json(), format);
            })()
        );

    transactionCommand
        .command('trash <transactionId>')
        .description('Trash a transaction')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId: string, options) =>
            withAction('trashing transaction', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const transaction = await trashTransaction(options.book, transactionId);
                renderItem(transaction.json(), format);
            })()
        );

    transactionCommand
        .command('merge <transactionId1> <transactionId2>')
        .description('Merge two transactions')
        .option('-b, --book <bookId>', 'Book ID')
        .action((transactionId1: string, transactionId2: string, options) =>
            withAction('merging transactions', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const result = await mergeTransactions(
                    options.book,
                    transactionId1,
                    transactionId2
                );
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
            })()
        );
}
