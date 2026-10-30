import {expect} from '../../helpers/test-setup.js';
import {Command} from 'commander';
import {registerContextCommands} from '../../../../src/commands/context/register.js';

describe('CLI - context command registration', function () {
    it('registers pull and the internal Git credential helper', function () {
        const program = new Command();
        registerContextCommands(program);
        const context = program.commands.find(command => command.name() === 'context');
        expect(context?.commands.map(command => command.name())).to.deep.equal(['pull', 'git-credential']);
        const helper = context?.commands.find(command => command.name() === 'git-credential');
        expect(helper?.registeredArguments.map(argument => argument.name())).to.deep.equal(['scope', 'operation']);
    });
});
