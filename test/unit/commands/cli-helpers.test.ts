import { expect } from '../helpers/test-setup.js';
import { Command, InvalidArgumentError } from 'commander';
import { parseOutputFormat, registerOutputOptions } from '../../../src/commands/cli-helpers.js';

describe('commands/cli-helpers', function () {
    describe('parseOutputFormat', function () {
        it('should accept json', function () {
            expect(parseOutputFormat('json')).to.equal('json');
        });

        for (const legacy of ['table', 'csv']) {
            it(`should reject ${legacy} with a jq hint`, function () {
                expect(() => parseOutputFormat(legacy))
                    .to.throw(InvalidArgumentError)
                    .with.property('message')
                    .that.contains('JSON only')
                    .and.contains('jq');
            });
        }
    });

    describe('registerOutputOptions', function () {
        function parse(args: string[]): Command {
            const program = new Command();
            program.exitOverride();
            program.configureOutput({ writeErr: () => {}, writeOut: () => {} });
            registerOutputOptions(program);
            program.command('noop').action(() => {});
            program.parse(['node', 'bkper', ...args]);
            return program;
        }

        it('should keep --json as an accepted no-op flag', function () {
            expect(() => parse(['--json', 'noop'])).to.not.throw();
        });

        it('should keep --format json as an accepted no-op flag', function () {
            expect(() => parse(['--format', 'json', 'noop'])).to.not.throw();
        });

        it('should fail when --format csv is passed', function () {
            expect(() => parse(['--format', 'csv', 'noop'])).to.throw(/JSON only/);
        });

        it('should not advertise output flags in help', function () {
            const program = new Command();
            registerOutputOptions(program);
            expect(program.helpInformation()).to.not.contain('--format');
            expect(program.helpInformation()).to.not.contain('--json');
        });
    });
});
