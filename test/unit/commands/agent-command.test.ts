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

    it('should forward pi package install command without injecting system prompt', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['install', 'npm:pi-slopchop'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal(['install', 'npm:pi-slopchop']);
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

    it('should route --continue to the embedded interactive mode wrapper', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--continue'], { runPi, runInteractiveMode });

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            continueSession: true,
        });
    });

    it('should route -c to the embedded interactive mode wrapper', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['-c'], { runPi, runInteractiveMode });

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            continueSession: true,
        });
    });

    it('should route --no-session to the embedded interactive mode wrapper', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--no-session'], { runPi, runInteractiveMode });

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            noSession: true,
        });
    });

    it('should route --resume to the embedded interactive mode wrapper as continue', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--resume'], { runPi, runInteractiveMode });

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            continueSession: true,
        });
    });

    it('should route -r to the embedded interactive mode wrapper as continue', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['-r'], { runPi, runInteractiveMode });

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            continueSession: true,
        });
    });

    it('should forward --session to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--session', 'abc123'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
            '--session',
            'abc123',
        ]);
    });

    it('should forward --mode rpc to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--mode', 'rpc'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });

    it('should forward --mode json to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--mode', 'json'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });

    it('should forward --print to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--print', 'hello'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });

    it('should forward --export to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--export', 'session.html'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });

    it('should forward --list-models to pi', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--list-models'], { runPi, runInteractiveMode });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });
});
