import {expect} from '../../../helpers/test-setup.js';
import {Command} from 'commander';
import {registerAppCommands} from '../../../../../src/commands/apps/register.js';

function findCommand(command: Command, name: string): Command {
    const found = command.commands.find(child => child.name() === name);
    if (!found) {
        throw new Error(`Command not found: ${name}`);
    }
    return found;
}

describe('CLI - app Git command registration', function () {
    it('registers clone and git-credential directly under app', function () {
        const program = new Command();
        registerAppCommands(program);

        const app = findCommand(program, 'app');
        const clone = findCommand(app, 'clone');
        const credential = findCommand(app, 'git-credential');

        expect(clone.registeredArguments.map(argument => argument.name())).to.deep.equal([
            'appId',
            'path',
        ]);
        expect(credential.registeredArguments.map(argument => argument.name())).to.deep.equal([
            'appId',
            'operation',
        ]);
        expect(credential.options.map(option => option.long)).to.not.include('--app');
        expect(app.commands.map(command => command.name())).to.not.include('git');
    });
});
