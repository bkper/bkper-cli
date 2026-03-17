import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { Command } from 'commander';
import { registerSkillsCommands } from '../../../src/commands/skills-command.js';

describe('CLI - skills commands', function () {
    it('should run skills sync command', async function () {
        const updateSkills = sinon.stub().resolves({
            updated: ['bkper-core'],
            skipped: false,
            commit: 'abc1234',
        });
        const log = sinon.stub();

        const program = new Command();
        registerSkillsCommands(program, {
            updateSkills,
            log,
        });

        await program.parseAsync(['node', 'bkper', 'skills', 'sync']);

        expect(updateSkills.calledOnce).to.be.true;
        expect(log.calledWithMatch('Synced skills')).to.be.true;
    });
});
