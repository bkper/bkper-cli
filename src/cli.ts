#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import { program } from 'commander';
import { login, logout } from './auth/local-auth-service.js';
import { registerAppCommands } from './commands/apps/register.js';
import { registerBookCommands } from './commands/books/register.js';
import { registerAccountCommands } from './commands/accounts/register.js';
import { registerGroupCommands } from './commands/groups/register.js';
import { registerTransactionCommands } from './commands/transactions/register.js';
import { registerBalanceCommands } from './commands/balances/register.js';
import { registerCollectionCommands } from './commands/collections/register.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { VERSION, autoUpgrade } from './upgrade/index.js';

// Version
program.version(VERSION, '-v, --version');

// Global output format options
program.option('--format <format>', 'Output format: table, json, or csv', 'table');
program.option('--json', 'Output as JSON (alias for --format json)');

// Auth commands
program
    .command('login')
    .description('Login Bkper')
    .action(async () => {
        await login();
    });

program
    .command('logout')
    .description('Logout Bkper')
    .action(() => {
        logout();
    });

// Resource commands
registerAppCommands(program);
registerBookCommands(program);
registerAccountCommands(program);
registerGroupCommands(program);
registerTransactionCommands(program);
registerBalanceCommands(program);
registerCollectionCommands(program);

// Upgrade command
registerUpgradeCommand(program);

// Trigger silent auto-upgrade in the background (non-blocking, never fails)
if (!process.env.BKPER_DISABLE_AUTOUPDATE) {
    autoUpgrade().catch(() => {});
}

program.parse(process.argv);
