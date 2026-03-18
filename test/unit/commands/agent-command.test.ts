import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { Command } from 'commander';
import { registerAgentCommands } from '../../../src/commands/agent-command.js';
import { getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('CLI - agent command', function () {
    it('should forward pi args and inject bkper system prompt by default', async function () {
        const runPi = sinon.stub().resolves();

        const program = new Command();
        registerAgentCommands(program, { runPi });

        await program.parseAsync(['node', 'bkper', 'agent', '--', '-p', 'hello']);

        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
            '-p',
            'hello',
        ]);
    });

    it('should not inject system prompt when user provides --system-prompt', async function () {
        const runPi = sinon.stub().resolves();

        const program = new Command();
        registerAgentCommands(program, { runPi });

        await program.parseAsync([
            'node',
            'bkper',
            'agent',
            '--',
            '--system-prompt',
            'custom prompt',
            '-p',
            'hello',
        ]);

        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            'custom prompt',
            '-p',
            'hello',
        ]);
    });

    it('should not inject system prompt when user provides --system-prompt=value', async function () {
        const runPi = sinon.stub().resolves();

        const program = new Command();
        registerAgentCommands(program, { runPi });

        await program.parseAsync([
            'node',
            'bkper',
            'agent',
            '--',
            '--system-prompt=custom prompt',
        ]);

        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal(['--system-prompt=custom prompt']);
    });
});
