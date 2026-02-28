import type { Command } from 'commander';
import { login, logout } from '../../auth/local-auth-service.js';
import { token } from './token.js';

export function registerAuthCommands(program: Command): void {
    const authCommand = program.command('auth').description('Manage authentication');

    authCommand
        .command('login')
        .description('Authenticate with Bkper, storing credentials locally')
        .action(async () => {
            await login();
        });

    authCommand
        .command('logout')
        .description('Remove stored credentials')
        .action(() => {
            logout();
        });

    authCommand
        .command('token')
        .description('Print the current OAuth access token to stdout')
        .action(async () => {
            await token();
        });
}
