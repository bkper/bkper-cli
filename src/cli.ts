#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program, type Command } from 'commander';
import { registerAuthCommands } from './commands/auth/register.js';
import { registerAppCommands } from './commands/apps/register.js';
import { registerBookCommands } from './commands/books/register.js';
import { registerAccountCommands } from './commands/accounts/register.js';
import { registerGroupCommands } from './commands/groups/register.js';
import { registerTransactionCommands } from './commands/transactions/register.js';
import { registerBalanceCommands } from './commands/balances/register.js';
import { registerCollectionCommands } from './commands/collections/register.js';
import { registerFileCommands } from './commands/files/register.js';
import { registerEventCommands } from './commands/events/register.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { registerOutputOptions } from './commands/cli-helpers.js';
import {
    getAgentCommandArgs,
    shouldRunAgentCommand,
    shouldShowHelpForBareInvocation,
} from './agent/cli-dispatch.js';
import { runAgentCommandInChild } from './agent/agent-command-runner.js';
import { VERSION } from './upgrade/index.js';
import { getUnsupportedNodeVersionMessage } from './utils/node-version.js';

function registerAgentCommands(command: Command): void {
    command
        .command('agent [piArgs...]')
        .description('Start Bkper Agent or run Pi CLI with Bkper defaults')
        .allowUnknownOption(true)
        .allowExcessArguments(true);
}

async function main(): Promise<void> {
    const unsupportedNodeVersionMessage = getUnsupportedNodeVersionMessage(process.version);
    if (unsupportedNodeVersionMessage) {
        console.error(unsupportedNodeVersionMessage);
        process.exit(1);
    }

    if (shouldRunAgentCommand(process.argv)) {
        try {
            await runAgentCommandInChild(getAgentCommandArgs(process.argv));
            return;
        } catch (err) {
            console.error('Error running agent command:', err);
            process.exit(1);
        }
    }

    // Version
    program.name('bkper');
    program.version(VERSION, '-v, --version');

    // Output is JSON only; legacy --json / --format json are accepted no-ops
    registerOutputOptions(program);

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
    registerFileCommands(program);
    registerEventCommands(program);

    // Agent bridge command
    registerAgentCommands(program);

    // Upgrade command
    registerUpgradeCommand(program);

    if (shouldShowHelpForBareInvocation(process.argv)) {
        program.outputHelp();
        return;
    }

    program.parse(process.argv);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
