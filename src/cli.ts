#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program } from 'commander';
import { registerAuthCommands } from './commands/auth/register.js';
import { registerAppCommands } from './commands/apps/register.js';
import { registerBookCommands } from './commands/books/register.js';
import { registerAccountCommands } from './commands/accounts/register.js';
import { registerGroupCommands } from './commands/groups/register.js';
import { registerTransactionCommands } from './commands/transactions/register.js';
import { registerBalanceCommands } from './commands/balances/register.js';
import { registerCollectionCommands } from './commands/collections/register.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { registerAgentCommands, runAgentCommand } from './commands/agent-command.js';
import { shouldRunAgentCommand } from './agent/cli-dispatch.js';
import { VERSION, autoUpgrade } from './upgrade/index.js';

async function main(): Promise<void> {
    if (shouldRunAgentCommand(process.argv)) {
        try {
            await runAgentCommand(process.argv.slice(3));
            return;
        } catch (err) {
            console.error('Error running agent command:', err);
            process.exit(1);
        }
    }

    // Version
    program.version(VERSION, '-v, --version');

    // Global output format options
    program.option('--format <format>', 'Output format: table, json, or csv', 'table');
    program.option('--json', 'Output as JSON (alias for --format json)');

    // Auth commands
    registerAuthCommands(program);

    // Resource commands
    registerAppCommands(program);
    registerBookCommands(program);
    registerAccountCommands(program);
    registerGroupCommands(program);
    registerTransactionCommands(program);
    registerBalanceCommands(program);
    registerCollectionCommands(program);

    // Agent bridge command
    registerAgentCommands(program);

    // Upgrade command
    registerUpgradeCommand(program);

    // Trigger silent auto-upgrade in the background (non-blocking, never fails)
    if (!process.env.BKPER_DISABLE_AUTOUPDATE) {
        autoUpgrade().catch(() => {});
    }

    program.parse(process.argv);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
