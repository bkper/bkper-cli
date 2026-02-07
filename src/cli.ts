#!/usr/bin/env node

import 'dotenv/config'; // Must be first to load env vars before other imports

import program from 'commander';
import { login, logout } from './auth/local-auth-service.js';
import { setupBkper } from './bkper-factory.js';
import {
    listApps,
    syncApp,
    deployApp,
    undeployApp,
    statusApp,
    initApp,
    secretsPut,
    secretsList,
    secretsDelete,
    dev,
    build,
    DevOptions,
} from './commands/apps/index.js';

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

// 'app' command group (singular, modern pattern)
const appCommand = program.command('app').description('Manage Bkper Apps');

appCommand
    .command('init <name>')
    .description('Create a new Bkper app from template')
    .action(async (name: string) => {
        try {
            await initApp(name);
        } catch (err) {
            console.error('Error initializing app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('list')
    .description('List all apps you have access to')
    .action(async () => {
        try {
            setupBkper();
            const apps = await listApps();

            if (apps.length === 0) {
                console.log('No apps found.');
                return;
            }

            // Table-style output
            console.log('\nApps:\n');
            console.log('ID'.padEnd(25) + 'Name'.padEnd(30) + 'Published');
            console.log('-'.repeat(65));

            for (const app of apps) {
                const id = (app.id || '').padEnd(25);
                const name = (app.name || '').padEnd(30);
                const published = app.published ? 'Yes' : 'No';
                console.log(`${id}${name}${published}`);
            }

            console.log(`\nTotal: ${apps.length} app(s)`);
        } catch (err) {
            console.error('Error listing apps:', err);
            process.exit(1);
        }
    });

appCommand
    .command('sync')
    .description('Sync app config to Bkper (creates if new, updates if exists)')
    .action(async () => {
        try {
            setupBkper();
            const result = await syncApp();
            console.log(`Synced ${result.id} (${result.action})`);
        } catch (err) {
            console.error('Error syncing app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('deploy')
    .description('Deploy app to Bkper Platform')
    .option('--dev', 'Deploy to development environment')
    .option('--events', 'Deploy events handler instead of web handler')
    .action(async options => {
        try {
            await deployApp(options);
        } catch (err) {
            console.error('Error deploying app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('undeploy')
    .description('Remove app from Bkper Platform')
    .option('--dev', 'Remove from development environment')
    .option('--events', 'Remove events handler instead of web handler')
    .option('--delete-data', 'Permanently delete all associated data (requires confirmation)')
    .option('--force', 'Skip confirmation prompts (use with --delete-data for automation)')
    .action(async options => {
        try {
            await undeployApp(options);
        } catch (err) {
            console.error('Error undeploying app:', err);
            process.exit(1);
        }
    });

appCommand
    .command('status')
    .description('Show deployment status for all handlers')
    .action(async () => {
        try {
            await statusApp();
        } catch (err) {
            console.error('Error getting app status:', err);
            process.exit(1);
        }
    });

// Development server command
appCommand
    .command('dev')
    .description('Start the development server')
    .option('-cp, --client-port <port>', 'Client dev server port', '5173')
    .option('-sp, --server-port <port>', 'Server simulation port', '8787')
    .option('-ep, --events-port <port>', 'Events handler port', '8791')
    .option('-w, --web', 'Run only the web handler')
    .option('-e, --events', 'Run only the events handler')
    .action(async options => {
        try {
            setupBkper();
            await dev({
                clientPort: parseInt(options.clientPort, 10),
                serverPort: parseInt(options.serverPort, 10),
                eventsPort: parseInt(options.eventsPort, 10),
                web: options.web,
                events: options.events,
            });
        } catch (err) {
            console.error('Error starting dev server:', err);
            process.exit(1);
        }
    });

// Build command
appCommand
    .command('build')
    .description('Build all configured handlers for deployment')
    .action(async () => {
        try {
            await build();
        } catch (err) {
            console.error('Error building app:', err);
            process.exit(1);
        }
    });

// Secrets subcommand
const secretsCommand = appCommand.command('secrets').description('Manage app secrets');

secretsCommand
    .command('put <name>')
    .description('Set a secret value')
    .option('--dev', 'Set in development environment')
    .action(async (name: string, options) => {
        try {
            await secretsPut(name, options);
        } catch (err) {
            console.error('Error setting secret:', err);
            process.exit(1);
        }
    });

secretsCommand
    .command('list')
    .description('List all secrets')
    .option('--dev', 'List from development environment')
    .action(async options => {
        try {
            await secretsList(options);
        } catch (err) {
            console.error('Error listing secrets:', err);
            process.exit(1);
        }
    });

secretsCommand
    .command('delete <name>')
    .description('Delete a secret')
    .option('--dev', 'Delete from development environment')
    .action(async (name: string, options) => {
        try {
            await secretsDelete(name, options);
        } catch (err) {
            console.error('Error deleting secret:', err);
            process.exit(1);
        }
    });

program.parse(process.argv);
