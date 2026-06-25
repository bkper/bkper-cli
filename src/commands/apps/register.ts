import type { Command } from 'commander';
import { withAction } from '../action.js';
import { collectProperty } from '../cli-helpers.js';
import { setupBkper } from '../../bkper-factory.js';
import { renderListResult, renderItem } from '../../render/index.js';
import { validateRequiredOptions, throwIfErrors } from '../../utils/validation.js';
import {
    getApp,
    listAppsFormatted,
    syncApp,
    deployApp,
    undeployApp,
    statusApp,
    logsApp,
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
        .command('get <appId>')
        .description('Get an app by ID')
        .action((appId: string) =>
            withAction('getting app', async format => {
                const app = await getApp(appId);
                renderItem(app.json(), format);
            })()
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
        .description('Show deployment status')
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
        .command('logs [appId]')
        .description('View recent app logs')
        .option('--since <time>', 'ISO8601 or relative lower bound such as 5m, 1h, or 15d')
        .option('--until <time>', 'ISO8601 or relative upper bound such as 5m, 1h, or 15d')
        .option('--last <n>', 'Show newest N requests after filters', value => Number.parseInt(value, 10))
        .option('-p, --preview', 'Query preview logs instead of production logs')
        .option('-w, --web', 'Filter to normal web/API requests')
        .option('-e, --events', 'Filter to /events requests')
        .option('--level <level>', 'Minimum log level threshold: info, warn, or error')
        .option('--status-code <code>', 'Filter by HTTP status code', value => Number.parseInt(value, 10))
        .action((appId: string | undefined, options, command) =>
            withAction(
                'getting app logs',
                async () => {
                    await logsApp(options, {}, command, appId);
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('dev')
        .description('Start the worker runtime for local development')
        .option('--sp, --server-port <port>', 'Server simulation port', '8787')
        .action(options =>
            withAction(
                'starting dev server',
                async () => {
                    setupBkper();
                    await dev({
                        serverPort: parseInt(options.serverPort, 10),

                    });
                },
                { skipSetup: true }
            )()
        );

    appCommand
        .command('build')
        .description('Build worker bundles for deployment')
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
