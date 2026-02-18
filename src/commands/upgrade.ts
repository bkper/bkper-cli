import type { Command } from 'commander';
import { foregroundUpgrade } from '../upgrade/index.js';

export function registerUpgradeCommand(program: Command): void {
    program
        .command('upgrade [version]')
        .description('Upgrade bkper CLI to the latest version')
        .option('--method <method>', 'Override install method detection (npm, bun, yarn)')
        .action(async (version: string | undefined, options: { method?: string }) => {
            await foregroundUpgrade(version, options.method);
        });
}
