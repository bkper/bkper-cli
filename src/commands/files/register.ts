import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { getFile, uploadFile } from './index.js';

export function registerFileCommands(program: Command): void {
    const fileCommand = program.command('file').description('Manage Files');

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
