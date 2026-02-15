import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { setupBkper } from '../../bkper-factory.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import {
    listAppsFormatted,
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
    installApp,
    uninstallApp,
} from './index.js';

export function registerAppCommands(program: Command): void {
    const appCommand = program.command('app').description('Manage Bkper Apps');

    appCommand
        .command('init <name>')
        .description('Create a new Bkper app from template')
        .action((name: string) =>
            withAction(
                'initializing app',
                async () => {
                    await initApp(name);
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('list')
        .description('List all apps you have access to')
        .action(
            withAction('listing apps', async format => {
                const result = await listAppsFormatted(format);
                renderListResult(result, format);
            })
        );

    appCommand
        .command('sync')
        .description('Sync app config to Bkper (creates if new, updates if exists)')
        .action(
            withAction('syncing app', async () => {
                const result = await syncApp();
                console.log(`Synced ${result.id} (${result.action})`);
            })
        );

    appCommand
        .command('deploy')
        .description('Deploy app to Bkper Platform')
        .option('-p, --preview', 'Deploy to preview environment')
        .option('--events', 'Deploy events handler instead of web handler')
        .action(options =>
            withAction(
                'deploying app',
                async () => {
                    await deployApp(options);
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('undeploy')
        .description('Remove app from Bkper Platform')
        .option('-p, --preview', 'Remove from preview environment')
        .option('--events', 'Remove events handler instead of web handler')
        .option('--delete-data', 'Permanently delete all associated data (requires confirmation)')
        .option('--force', 'Skip confirmation prompts (use with --delete-data for automation)')
        .action(options =>
            withAction(
                'undeploying app',
                async () => {
                    await undeployApp(options);
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('status')
        .description('Show deployment status for all handlers')
        .action(options =>
            withAction(
                'getting app status',
                async () => {
                    await statusApp();
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('dev')
        .description('Start the development server')
        .option('--cp, --client-port <port>', 'Client dev server port', '5173')
        .option('--sp, --server-port <port>', 'Server simulation port', '8787')
        .option('--ep, --events-port <port>', 'Events handler port', '8791')
        .option('-w, --web', 'Run only the web handler')
        .option('-e, --events', 'Run only the events handler')
        .option('--no-open', 'Do not open browser on startup')
        .action(options =>
            withAction(
                'starting dev server',
                async () => {
                    setupBkper();
                    await dev({
                        clientPort: parseInt(options.clientPort, 10),
                        serverPort: parseInt(options.serverPort, 10),
                        eventsPort: parseInt(options.eventsPort, 10),
                        web: options.web,
                        events: options.events,
                        open: options.open,
                    });
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('build')
        .description('Build all configured handlers for deployment')
        .action(
            withAction(
                'building app',
                async () => {
                    await build();
                },
                { skipSetup: true }
            )
        );

    // Secrets subcommands
    const secretsCommand = appCommand.command('secrets').description('Manage app secrets');

    secretsCommand
        .command('put <name>')
        .description('Set a secret value')
        .option('-p, --preview', 'Set in preview environment')
        .action((name: string, options) =>
            withAction(
                'setting secret',
                async () => {
                    await secretsPut(name, options);
                },
                { skipSetup: true }
            )()
        );

    secretsCommand
        .command('list')
        .description('List all secrets')
        .option('-p, --preview', 'List from preview environment')
        .action(options =>
            withAction(
                'listing secrets',
                async () => {
                    await secretsList(options);
                },
                { skipSetup: true }
            )()
        );

    secretsCommand
        .command('delete <name>')
        .description('Delete a secret')
        .option('-p, --preview', 'Delete from preview environment')
        .action((name: string, options) =>
            withAction(
                'deleting secret',
                async () => {
                    await secretsDelete(name, options);
                },
                { skipSetup: true }
            )()
        );

    // Install/Uninstall
    appCommand
        .command('install <appId>')
        .description('Install an app into a book')
        .option('-b, --book <bookId>', 'Book ID')
        .action((appId: string, options) =>
            withAction('installing app', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const integration = await installApp(options.book, appId);
                renderItem(integration.json(), format);
            })()
        );

    appCommand
        .command('uninstall <appId>')
        .description('Uninstall an app from a book')
        .option('-b, --book <bookId>', 'Book ID')
        .action((appId: string, options) =>
            withAction('uninstalling app', async format => {
                throwIfErrors(validateRequiredOptions(options, [{ name: 'book', flag: '--book' }]));
                const integration = await uninstallApp(options.book, appId);
                renderItem(integration.json(), format);
            })()
        );
}
