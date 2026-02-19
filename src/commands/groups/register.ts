import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { parseStdinItems } from '../../input/index.js';
import {
    listGroupsFormatted,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    batchCreateGroups,
} from './index.js';

export function registerGroupCommands(program: Command): void {
    const groupCommand = program.command('group').description('Manage Groups');

    groupCommand
        .command('list')
        .description('List all groups in a book')
        .option('-b, --book <bookId>', 'Book ID')
        .action(options =>
            withAction('listing groups', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const result = await listGroupsFormatted(options.book, format);
                renderListResult(result, format);
            })()
        );

    groupCommand
        .command('get <idOrName>')
        .description('Get a group by ID or name')
        .option('-b, --book <bookId>', 'Book ID')
        .action((idOrName: string, options) =>
            withAction('getting group', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const group = await getGroup(options.book, idOrName);
                renderItem(group.json(), format);
            })()
        );

    groupCommand
        .command('create')
        .description('Create a new group')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--name <name>', 'Group name')
        .option('--parent <parent>', 'Parent group name or ID')
        .option('--hidden', 'Hide the group')
        .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
        .action(options =>
            withAction('creating group', async format => {
                const stdinData = !process.stdin.isTTY ? await parseStdinItems() : null;

                if (stdinData && stdinData.items.length > 0) {
                    throwIfErrors(
                        validateRequiredOptions(options, [{ name: 'book', flag: '--book' }])
                    );
                    await batchCreateGroups(options.book, stdinData.items, options.property);
                } else if (stdinData && stdinData.items.length === 0) {
                    console.log(JSON.stringify([], null, 2));
                } else {
                    throwIfErrors(
                        validateRequiredOptions(options, [
                            { name: 'book', flag: '--book' },
                            { name: 'name', flag: '--name' },
                        ])
                    );
                    const group = await createGroup(options.book, {
                        name: options.name,
                        parent: options.parent,
                        hidden: options.hidden,
                        property: options.property,
                    });
                    renderItem(group.json(), format);
                }
            })()
        );

    groupCommand
        .command('update <idOrName>')
        .description('Update a group')
        .option('-b, --book <bookId>', 'Book ID')
        .option('--name <name>', 'Group name')
        .option('--hidden <hidden>', 'Hide status (true/false)')
        .option('-p, --property <key=value>', 'Set a property (repeatable)', collectProperty)
        .action((idOrName: string, options) =>
            withAction('updating group', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const group = await updateGroup(options.book, idOrName, {
                    name: options.name,
                    hidden: options.hidden !== undefined ? options.hidden === 'true' : undefined,
                    property: options.property,
                });
                renderItem(group.json(), format);
            })()
        );

    groupCommand
        .command('delete <idOrName>')
        .description('Delete a group')
        .option('-b, --book <bookId>', 'Book ID')
        .action((idOrName: string, options) =>
            withAction('deleting group', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const group = await deleteGroup(options.book, idOrName);
                renderItem(group.json(), format);
            })()
        );
}
