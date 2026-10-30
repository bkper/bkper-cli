import {expect} from '../../helpers/test-setup.js';
import {Command} from 'commander';
import {registerContextCommands} from '../../../../src/commands/context/register.js';
import {registerBookCommands} from '../../../../src/commands/books/register.js';

describe('CLI - context command registration', function () {
    it('registers pull, with a Book option, and the internal Git credential helper', function () {
        const program = new Command();
        registerContextCommands(program);
        const context = program.commands.find(command => command.name() === 'context');
        expect(context?.commands.map(command => command.name())).to.deep.equal(['pull', 'git-credential']);
        const pull = context?.commands.find(command => command.name() === 'pull');
        expect(pull?.options.map(option => option.flags)).to.deep.equal(['-b, --book <bookId>']);
        const helper = context?.commands.find(command => command.name() === 'git-credential');
        expect(helper?.registeredArguments.map(argument => argument.name())).to.deep.equal(['scope', 'operation']);
    });

    it('has no book clone: a Book context is pulled like the user one', function () {
        const program = new Command();
        registerBookCommands(program);
        const book = program.commands.find(command => command.name() === 'book');
        expect(book?.commands.map(command => command.name())).to.not.include('clone');
    });
});
