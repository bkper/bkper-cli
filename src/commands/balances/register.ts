import type { Command } from 'commander';
import { withAction } from '../action.js';
import { renderTable } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import { listBalancesMatrix } from './index.js';

export function registerBalanceCommands(program: Command): void {
    const balanceCommand = program.command('balance').description('Manage Balances');

    balanceCommand
        .command('list')
        .description('List balances')
        .option('-b, --book <bookId>', 'Book ID')
        .option('-q, --query <query>', 'Balances query')
        .option('--expanded <level>', 'Expand groups to specified depth (0+)', parseInt)
        .action(options =>
            withAction('listing balances', async format => {
                throwIfErrors(
                    validateRequiredOptions(options, [
                        { name: 'book', flag: '--book' },
                        { name: 'query', flag: '--query' },
                    ])
                );
                const matrix = await listBalancesMatrix(options.book, {
                    query: options.query,
                    expanded: options.expanded,
                    format,
                });
                renderTable(matrix, format);
            })()
        );
}
