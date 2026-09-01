import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    getBkperHandoffShortcut,
    getBkperHandoffShortcutFromFile,
    registerBkperHandoffExtension,
    type HandoffDependencies,
} from '../../../../src/agent/extensions/handoff.js';

type CommandHandler = (args: string, context: TestCommandContext) => Promise<void>;

interface TestContext {
    mode: 'tui';
    model?: {provider: string; id: string};
    ui: {
        editor: sinon.SinonStub;
        getEditorText: sinon.SinonStub;
        notify: sinon.SinonStub;
    };
    sessionManager: {
        buildContextEntries: sinon.SinonStub;
        getSessionFile: () => string;
    };
    getContextUsage: () => {
        tokens: number | null;
        contextWindow: number;
        percent: number | null;
    };
}

interface TestCommandContext extends TestContext {
    waitForIdle: sinon.SinonStub;
    newSession: sinon.SinonStub;
    appendSessionInfo: sinon.SinonStub;
    setEditorText: sinon.SinonStub;
    replacementNotify: sinon.SinonStub;
}

function createDependencies(): {
    dependencies: HandoffDependencies;
    generatePrompt: sinon.SinonStub;
} {
    const generatePrompt = sinon.stub().resolves('## Context\nExisting work\n\n## Task\nFinish it');
    return {
        dependencies: {generatePrompt},
        generatePrompt,
    };
}

function createContext(tokens = 100_000): TestContext {
    return {
        mode: 'tui',
        model: {provider: 'bkper', id: 'test-model'},
        ui: {
            editor: sinon.stub().resolves('Finish the handoff feature'),
            getEditorText: sinon.stub().returns(''),
            notify: sinon.stub(),
        },
        sessionManager: {
            buildContextEntries: sinon.stub().returns([
                {
                    type: 'message',
                    id: 'user-entry',
                    parentId: null,
                    timestamp: new Date(1).toISOString(),
                    message: {
                        role: 'user',
                        content: [{type: 'text', text: 'Please implement handoff support'}],
                        timestamp: 1,
                    },
                },
                {
                    type: 'message',
                    id: 'assistant-entry',
                    parentId: 'user-entry',
                    timestamp: new Date(2).toISOString(),
                    message: {
                        role: 'assistant',
                        content: [{type: 'text', text: 'I have explored the implementation.'}],
                        provider: 'bkper',
                        model: 'test-model',
                        usage: {
                            input: 10,
                            output: 10,
                            cacheRead: 0,
                            cacheWrite: 0,
                            totalTokens: 20,
                            cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0},
                        },
                        stopReason: 'stop',
                        timestamp: 2,
                    },
                },
            ]),
            getSessionFile: () => '/sessions/parent.jsonl',
        },
        getContextUsage: () => ({
            tokens,
            contextWindow: 128_000,
            percent: (tokens / 128_000) * 100,
        }),
    };
}

function createCommandContext(tokens = 100_000): TestCommandContext {
    const context = createContext(tokens) as TestCommandContext;
    context.waitForIdle = sinon.stub().resolves();
    context.appendSessionInfo = sinon.stub();
    context.setEditorText = sinon.stub();
    context.replacementNotify = sinon.stub();
    context.newSession = sinon.stub().callsFake(async options => {
        await options.setup?.({appendSessionInfo: context.appendSessionInfo});
        await options.withSession?.({
            ui: {
                setEditorText: context.setEditorText,
                notify: context.replacementNotify,
            },
        });
        return {cancelled: false};
    });
    return context;
}

function registerHandoff(
    dependencies = createDependencies().dependencies,
    shortcut: string | undefined = 'ctrl+h'
): {
    command: CommandHandler;
    shortcutHandler: (context: TestContext) => Promise<void> | void;
    dispatchCommand: sinon.SinonStub;
} {
    let command: CommandHandler | undefined;
    let shortcutHandler: ((context: TestContext) => Promise<void> | void) | undefined;
    const dispatchCommand = sinon.stub().resolves();

    registerBkperHandoffExtension(
        {
            registerCommand: ((_name: string, options: {handler: CommandHandler}) => {
                command = options.handler;
            }) as unknown as ExtensionAPI['registerCommand'],
            registerShortcut: ((_shortcut: string, options: {handler: typeof shortcutHandler}) => {
                shortcutHandler = options.handler;
            }) as unknown as ExtensionAPI['registerShortcut'],
        },
        dispatchCommand,
        shortcut as 'ctrl+h',
        dependencies
    );

    expect(command).to.not.equal(undefined);
    return {
        command: command as CommandHandler,
        shortcutHandler: shortcutHandler as (context: TestContext) => Promise<void> | void,
        dispatchCommand,
    };
}

describe('agent handoff', function () {
    it('registers Ctrl+H through Pi shortcut lifecycle', async function () {
        const {shortcutHandler, dispatchCommand} = registerHandoff();

        await shortcutHandler(createContext());

        expect(dispatchCommand.calledOnceWithExactly('/handoff')).to.equal(true);
    });

    it('prefills the Ctrl+H goal editor with the current input text', async function () {
        const {dependencies} = createDependencies();
        const {shortcutHandler, command} = registerHandoff(dependencies);
        const shortcutContext = createContext();
        shortcutContext.ui.getEditorText.returns('Finish the feature I am describing');

        await shortcutHandler(shortcutContext);

        const commandContext = createCommandContext();
        commandContext.ui.editor.resolves('Finish the edited feature');
        await command('', commandContext);

        expect(
            commandContext.ui.editor.calledOnceWithExactly(
                'Next session goal',
                'Finish the feature I am describing'
            )
        ).to.equal(true);
    });

    it('preserves a user binding that claims Ctrl+H', function () {
        const directory = mkdtempSync(path.join(tmpdir(), 'bkper-keybindings-'));
        writeFileSync(
            path.join(directory, 'keybindings.json'),
            JSON.stringify({
                'tui.editor.deleteCharBackward': ['backspace', 'ctrl+h'],
            })
        );

        const shortcut = getBkperHandoffShortcutFromFile(directory);
        const registerShortcut = sinon.stub();
        registerBkperHandoffExtension(
            {
                registerCommand: sinon.stub(),
                registerShortcut,
            },
            sinon.stub().resolves(),
            shortcut,
            createDependencies().dependencies
        );

        expect(shortcut).to.equal(undefined);
        expect(registerShortcut.called).to.equal(false);
        expect(getBkperHandoffShortcut({})).to.equal('ctrl+h');
    });

    it('uses an explicit goal without opening the goal editor', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const {command} = registerHandoff(dependencies);
        const context = createCommandContext();

        await command('Implement phase two', context);

        expect(context.waitForIdle.calledOnce).to.equal(true);
        expect(context.ui.editor.called).to.equal(false);
        expect(context.waitForIdle.calledBefore(context.sessionManager.buildContextEntries)).to.equal(
            true
        );
        expect(generatePrompt.calledOnce).to.equal(true);
        expect(generatePrompt.firstCall.args[0].goal).to.equal('Implement phase two');
        expect(generatePrompt.firstCall.args[0].conversation).to.include(
            'Please implement handoff support'
        );
        expect(context.newSession.calledOnce).to.equal(true);
        expect(context.newSession.firstCall.args[0].parentSession).to.equal(
            '/sessions/parent.jsonl'
        );
        expect(context.appendSessionInfo.calledOnceWithExactly('Implement phase two')).to.equal(
            true
        );
        expect(context.setEditorText.calledOnceWithExactly(
            '## Context\nExisting work\n\n## Task\nFinish it'
        )).to.equal(true);
        expect(context.replacementNotify.calledOnceWithExactly(
            'Handoff ready. Submit when ready.',
            'info'
        )).to.equal(true);
    });

    it('opens an empty goal editor when /handoff has no goal', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const {command} = registerHandoff(dependencies);
        const context = createCommandContext();
        context.ui.editor.resolves('Use my custom goal');

        await command('', context);

        expect(context.ui.editor.calledOnceWithExactly('Next session goal', '')).to.equal(true);
        expect(context.ui.editor.calledBefore(context.waitForIdle)).to.equal(true);
        expect(context.waitForIdle.calledBefore(context.sessionManager.buildContextEntries)).to.equal(
            true
        );
        expect(context.sessionManager.buildContextEntries.calledBefore(generatePrompt)).to.equal(
            true
        );
        expect(generatePrompt.firstCall.args[0].goal).to.equal('Use my custom goal');
    });

    for (const cancelledGoal of [undefined, '   ']) {
        it(`cancels without waiting when the goal is ${
            cancelledGoal === undefined ? 'cancelled' : 'empty'
        }`, async function () {
            const {dependencies, generatePrompt} = createDependencies();
            const {command} = registerHandoff(dependencies);
            const context = createCommandContext();
            context.ui.editor.resolves(cancelledGoal);

            await command('', context);

            expect(context.waitForIdle.called).to.equal(false);
            expect(context.sessionManager.buildContextEntries.called).to.equal(false);
            expect(generatePrompt.called).to.equal(false);
            expect(context.newSession.called).to.equal(false);
        });
    }
});
