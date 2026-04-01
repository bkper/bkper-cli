import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { runAgentCommand } from '../../../src/commands/agent-command.js';
import { getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';

describe('CLI - agent command', function () {
    it('should start embedded interactive mode when no pi args are provided', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand([], { runPi, runInteractiveMode });

        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runPi.called).to.be.false;
    });

    it('should forward pi args without requiring -- and inject bkper system prompt by default', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['-p', 'hello'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
            '-p',
            'hello',
        ]);
    });

    it('should pass --help through to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--help'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
            '--help',
        ]);
    });

    it('should not inject system prompt when user provides --system-prompt', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--system-prompt', 'custom prompt', '-p', 'hello'], {
            runPi,
            runInteractiveMode,
        });

        expect(runInteractiveMode.called).to.be.false;
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
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--system-prompt=custom prompt'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal(['--system-prompt=custom prompt']);
    });
});
