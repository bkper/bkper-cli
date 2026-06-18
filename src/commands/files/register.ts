import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty, parsePositiveInteger } from '../cli-helpers.js';
import { renderItem, renderListResult } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { getFile, listFilesFormatted, uploadFile } from './index.js';

export function registerFileCommands(program: Command): void {
    const fileCommand = program.command('file').description('Manage Files');

    fileCommand
        .command('list')
        .description('List files in a book')
        .option('-b, --book <bookId>', 'Book ID')
        .option(
            '--limit <limit>',
            'Fetch one page with up to this many files',
            parsePositiveInteger
        )
        .option('--cursor <cursor>', 'Cursor for fetching the next page')
        .action(options =>
            withAction('listing files', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const result = await listFilesFormatted(
                    options.book,
                    { limit: options.limit, cursor: options.cursor },
                    format
                );
                renderListResult(result, format);
            })()
        );

    fileCommand
        .command('get <fileId>')
        .description('Get a file by ID')
        .option('-b, --book <bookId>', 'Book ID')
        .action((fileId: string, options) =>
            withAction('getting file', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const file = await getFile(options.book, fileId);
                renderItem(file.json(), format);
            })()
        );

    fileCommand
        .command('upload <path>')
        .description('Upload a local file to a book')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--account <accountIdOrName>', 'Account name or ID for file routing')
        .option(
            '-p, --property <key=value>',
            'Set a property (repeatable, empty value deletes)',
            collectProperty
        )
        .action((filePath: string, options) =>
            withAction('uploading file', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const file = await uploadFile(options.book, {
                    path: filePath,
                    account: options.account,
                    property: options.property,
                });
                renderItem(file.json(), format);
            })()
        );
}
