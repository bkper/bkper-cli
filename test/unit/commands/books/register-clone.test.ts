import {expect} from '../../helpers/test-setup.js';
import {Command} from 'commander';
import {registerBookCommands} from '../../../../src/commands/books/register.js';

describe('CLI - book clone registration', function () {
    it("registers clone with the Book ID and an optional folder", function () {
        const program = new Command();
        registerBookCommands(program);
        const book = program.commands.find(command => command.name() === 'book');
        const clone = book?.commands.find(command => command.name() === 'clone');
        expect(clone?.registeredArguments.map(argument => [argument.name(), argument.required])).to.deep.equal([
            ['bookId', true],
            ['folder', false],
        ]);
    });
});
