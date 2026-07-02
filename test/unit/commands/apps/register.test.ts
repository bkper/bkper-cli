import { expect } from '../../helpers/test-setup.js';
import { Command } from 'commander';
import { registerAppCommands } from '../../../../src/commands/apps/register.js';

function findCommand(command: Command, name: string): Command {
    const found = command.commands.find(child => child.name() === name);
    if (!found) {
        throw new Error(`Command not found: ${name}`);
    }
    return found;
}

function optionLongNames(command: Command): string[] {
    return command.options.map(option => option.long).filter((name): name is string => Boolean(name));
}

describe('CLI - app command registration', function () {
    it('should not register removed split-worker flags', function () {
        const program = new Command();
        registerAppCommands(program);

        const app = findCommand(program, 'app');
        const get = findCommand(app, 'get');
        const deploy = findCommand(app, 'deploy');
        const undeploy = findCommand(app, 'undeploy');
        const dev = findCommand(app, 'dev');
        const logs = findCommand(app, 'logs');

        expect(get.registeredArguments.map(argument => argument.name())).to.deep.equal(['appId']);
        expect(logs.registeredArguments.map(argument => argument.name())).to.deep.equal(['appId']);
        expect(optionLongNames(deploy)).to.not.include('--events');
        expect(optionLongNames(undeploy)).to.not.include('--events');
        expect(optionLongNames(dev)).to.not.include('--events');
        expect(optionLongNames(dev)).to.not.include('--web');
        expect(optionLongNames(dev)).to.not.include('--events-port');
        expect(optionLongNames(dev)).to.include('--client-port');

        // Log flags remain as request-category filters, not deployment selectors.
        expect(optionLongNames(logs)).to.include('--web');
        expect(optionLongNames(logs)).to.include('--events');
        expect(optionLongNames(logs)).to.include('--level');
        expect(optionLongNames(logs)).to.not.include('--outcome');
    });
});
