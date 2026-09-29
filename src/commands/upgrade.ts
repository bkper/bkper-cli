import type { Command } from 'commander';
import { foregroundUpgrade } from '../upgrade/index.js';

export function registerUpgradeCommand(program: Command): void {
    program
        .command('upgrade [version]')
        .description('Upgrade bkper CLI to the latest version')
        .action(async (version: string | undefined) => {
            await foregroundUpgrade(version);
        });
}
