import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import sinon from 'sinon';
import { runAgentCommand } from '../../../src/commands/agent-command.js';
import { getBkperAgentSystemPrompt } from '../../../src/agent/system-prompt.js';
import { registerBkperAiProvider } from '../../../src/agent/extensions/bkper-ai-provider.js';

describe('CLI - agent command', function () {
    for (const args of [['--list-models'], ['-p', 'hello'], ['--mode', 'json', 'hello']]) {
        it(`should offer Bkper AI models in pi sessions it forwards: ${args.join(' ')}`, async function () {
            const runPi = sinon.stub().resolves();

            await runAgentCommand(args, { runPi, runInteractiveMode: sinon.stub().resolves() });

            expect(runPi.firstCall.args[1]).to.deep.equal({
                extensionFactories: [registerBkperAiProvider],
            });
        });
    }

    it('should not add Bkper AI to pi management commands', async function () {
        const runPi = sinon.stub().resolves();

        await runAgentCommand(['config'], { runPi, runInteractiveMode: sinon.stub().resolves() });

        expect(runPi.firstCall.args[1]).to.equal(undefined);
    });

    it('should start embedded interactive mode when no pi args are provided', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand([], { runPi, runInteractiveMode });

        expect(runInteractiveMode.calledOnce).to.be.true;
        expect(runPi.called).to.be.false;
    });

    it('should forward bare agent invocation to pi when terminal is not interactive', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand([], {
            runPi,
            runInteractiveMode,
            environment: {stdinIsTTY: false, stdoutIsTTY: true},
        });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
        ]);
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

    it('should forward pi mcp commands without injecting system prompt', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['mcp', 'add', 'docs', '--url', 'https://example.com/mcp'], {
            runPi,
            runInteractiveMode,
        });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            'mcp',
            'add',
            'docs',
            '--url',
            'https://example.com/mcp',
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

    it('should forward -c to pi when terminal is not interactive', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['-c'], {
            runPi,
            runInteractiveMode,
            environment: {stdinIsTTY: false, stdoutIsTTY: true},
        });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
        expect(runPi.firstCall.args[0]).to.deep.equal([
            '--system-prompt',
            getBkperAgentSystemPrompt(),
            '-c',
        ]);
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

    it('should start Bkper Agent with the args a subagent launches it with', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(
            [
                '--approve',
                '--session',
                '/runs/abc/session.jsonl',
                '--provider',
                'anthropic',
                '--model',
                'claude-opus',
                '--thinking',
                'high',
                '--tools',
                'read,bash',
                '--no-extensions',
                '--extension',
                '/ext/subagent',
                '--no-skills',
                '--no-prompt-templates',
                '--no-context-files',
                '@/tmp/brief.md',
                'Task:\nReview the diff',
            ],
            { runPi, runInteractiveMode }
        );

        expect(runPi.called).to.be.false;
        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            sessionFile: '/runs/abc/session.jsonl',
            provider: 'anthropic',
            model: 'claude-opus',
            thinking: 'high',
            tools: ['read', 'bash'],
            extensionPaths: ['/ext/subagent'],
            noExtensions: true,
            noSkills: true,
            noPromptTemplates: true,
            noContextFiles: true,
            messages: ['Task:\nReview the diff'],
            fileArgs: ['/tmp/brief.md'],
        });
    });

    it('should resolve a relative --session file against the current directory', async function () {
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--session', 'runs/session.jsonl'], {
            runPi: sinon.stub().resolves(),
            runInteractiveMode,
        });

        expect(runInteractiveMode.firstCall.args[0]).to.deep.equal({
            sessionFile: path.resolve('runs/session.jsonl'),
        });
    });

    it('should forward subagent args to pi when terminal is not interactive', async function () {
        const runPi = sinon.stub().resolves();
        const runInteractiveMode = sinon.stub().resolves();

        await runAgentCommand(['--session', '/runs/abc/session.jsonl', 'hello'], {
            runPi,
            runInteractiveMode,
            environment: {stdinIsTTY: true, stdoutIsTTY: false},
        });

        expect(runInteractiveMode.called).to.be.false;
        expect(runPi.calledOnce).to.be.true;
    });

    for (const args of [
        ['--no-approve'],
        ['--fork', 'abc123'],
        ['--models', 'claude*'],
        ['--custom-extension-flag'],
        ['--thinking', 'bogus'],
        ['--session', '/runs/abc/session.jsonl', '--print', 'hello'],
    ]) {
        it(`should forward args only pi supports to pi: ${args.join(' ')}`, async function () {
            const runPi = sinon.stub().resolves();
            const runInteractiveMode = sinon.stub().resolves();

            await runAgentCommand(args, { runPi, runInteractiveMode });

            expect(runInteractiveMode.called).to.be.false;
            expect(runPi.calledOnce).to.be.true;
        });
    }

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
