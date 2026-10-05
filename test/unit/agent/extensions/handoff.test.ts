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
    editGoal: sinon.SinonStub;
    model?: {provider: string; id: string};
    ui: {
        getEditorText: sinon.SinonStub;
        setEditorText: sinon.SinonStub;
        custom: sinon.SinonStub;
        notify: sinon.SinonStub;
    };
    sessionManager: {
        buildContextEntries: sinon.SinonStub;
        buildSessionProjection: sinon.SinonStub;
        getSessionFile: () => string;
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
    dependencies: Pick<HandoffDependencies, 'generatePrompt'>;
    generatePrompt: sinon.SinonStub;
} {
    const generatePrompt = sinon.stub().resolves('## Context\nExisting work\n\n## Task\nFinish it');
    return {
        dependencies: {generatePrompt},
        generatePrompt,
    };
}

function createContext(): TestContext {
    return {
        mode: 'tui',
        editGoal: sinon.stub().resolves({status: 'submitted', text: 'Finish the handoff feature'}),
        model: {provider: 'bkper', id: 'test-model'},
        ui: {
            getEditorText: sinon.stub().returns(''),
            setEditorText: sinon.stub(),
            custom: sinon.stub(),
            notify: sinon.stub(),
        },
        sessionManager: {
            buildContextEntries: sinon.stub().returns([]),
            buildSessionProjection: sinon.stub().returns({
                messages: [
                    {
                        role: 'user',
                        content: [{type: 'text', text: 'Please implement handoff support'}],
                        timestamp: 1,
                    },
                    {
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
                ],
            }),
            getSessionFile: () => '/sessions/parent.jsonl',
        },
    };
}

function createCommandContext(): TestCommandContext {
    const context = createContext() as TestCommandContext;
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
    dependencies?: Partial<HandoffDependencies>,
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
        {
            editGoal: (prefill, context) =>
                (context as unknown as TestContext).editGoal(prefill),
            ...dependencies,
        }
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
        commandContext.editGoal.resolves({status: 'submitted', text: 'Finish the edited feature'});
        await command('', commandContext);

        expect(
            commandContext.editGoal.calledOnceWithExactly('Finish the feature I am describing')
        ).to.equal(true);
    });

    for (const scenario of [
        'cancelled goal',
        'empty goal',
        'cancelled generation',
        'failed generation',
        'cancelled session',
        'failed session',
        'missing model',
        'empty conversation',
    ]) {
        it(`restores the original Ctrl+H draft after ${scenario}`, async function () {
            const {dependencies, generatePrompt} = createDependencies();
            const {shortcutHandler, command} = registerHandoff(
                scenario === 'cancelled generation' ? undefined : dependencies
            );
            const draft = '  Original draft\nwith another line  ';
            const shortcutContext = createContext();
            shortcutContext.ui.getEditorText.returns(draft);
            await shortcutHandler(shortcutContext);

            // The command may run after the main input has been cleared.
            const context = createCommandContext();
            context.editGoal.resolves({status: 'submitted', text: 'Edited goal, not the original draft'});
            if (scenario === 'cancelled goal') {
                context.editGoal.resolves({status: 'cancelled', text: draft});
            }
            if (scenario === 'empty goal') context.editGoal.resolves({status: 'submitted', text: '   '});
            if (scenario === 'cancelled generation') {
                context.ui.custom.resolves({status: 'cancelled'});
            }
            if (scenario === 'failed generation') generatePrompt.rejects(new Error('offline'));
            if (scenario === 'cancelled session') context.newSession.resolves({cancelled: true});
            if (scenario === 'failed session') context.newSession.rejects(new Error('unavailable'));
            if (scenario === 'missing model') context.model = undefined;
            if (scenario === 'empty conversation') {
                context.sessionManager.buildSessionProjection.returns({messages: []});
            }

            try {
                await command('', context);
            } catch (error) {
                if (scenario !== 'failed session') throw error;
            }

            expect(context.ui.setEditorText.calledOnceWithExactly(draft)).to.equal(true);
            expect(context.setEditorText.called).to.equal(false);
            if (scenario === 'missing model') {
                // An early exit must not leave a stale prefill for a later /handoff.
                const nextContext = createCommandContext();
                nextContext.editGoal.resolves({status: 'cancelled', text: ''});
                await command('', nextContext);
                expect(nextContext.editGoal.calledOnceWithExactly('')).to.equal(true);
                expect(nextContext.ui.setEditorText.calledOnceWithExactly('')).to.equal(true);
            }
        });
    }

    it('restores cancelled goal text from an explicit result without editor side effects', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const latestDraft = '  text for handoff\nwith more edits  ';
        const editGoal = sinon.stub().resolves({status: 'cancelled', text: latestDraft});
        const {shortcutHandler, command} = registerHandoff({...dependencies, editGoal});
        const shortcutContext = createContext();
        shortcutContext.ui.getEditorText.returns('Original input');
        await shortcutHandler(shortcutContext);
        const context = createCommandContext();

        await command('', context);

        expect(editGoal.calledOnceWithExactly('Original input', context)).to.equal(true);
        expect(context.ui.setEditorText.calledOnceWithExactly(latestDraft)).to.equal(true);
        expect(context.waitForIdle.called).to.equal(false);
        expect(generatePrompt.called).to.equal(false);
        expect(context.newSession.called).to.equal(false);
    });

    it('does not restore the old draft into a successful replacement session', async function () {
        const {dependencies} = createDependencies();
        const {shortcutHandler, command} = registerHandoff(dependencies);
        const shortcutContext = createContext();
        shortcutContext.ui.getEditorText.returns('Original draft');
        await shortcutHandler(shortcutContext);
        const context = createCommandContext();

        await command('', context);

        expect(context.ui.setEditorText.called).to.equal(false);
        expect(
            context.setEditorText.calledOnceWithExactly(
                '## Context\nExisting work\n\n## Task\nFinish it'
            )
        ).to.equal(true);
    });

    it('restores the draft when shortcut dispatch fails and clears the pending prefill', async function () {
        const {shortcutHandler, command, dispatchCommand} = registerHandoff();
        const context = createContext();
        context.ui.getEditorText.returns('Original draft');
        dispatchCommand.rejects(new Error('dispatch failed'));

        await shortcutHandler(context);

        expect(context.ui.setEditorText.calledOnceWithExactly('Original draft')).to.equal(true);
        const nextContext = createCommandContext();
        nextContext.editGoal.resolves({status: 'cancelled', text: ''});
        await command('', nextContext);
        expect(nextContext.editGoal.calledOnceWithExactly('')).to.equal(true);
        expect(nextContext.ui.setEditorText.calledOnceWithExactly('')).to.equal(true);
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
        expect(context.editGoal.called).to.equal(false);
        expect(
            context.waitForIdle.calledBefore(context.sessionManager.buildSessionProjection)
        ).to.equal(true);
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

    it('serializes the canonical projected session messages', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const {command} = registerHandoff(dependencies);
        const context = createCommandContext();
        context.sessionManager.buildContextEntries.returns([
            {
                type: 'message',
                message: {
                    role: 'assistant',
                    content: [{type: 'text', text: 'Abandoned response'}],
                },
            },
        ]);
        context.sessionManager.buildSessionProjection.returns({
            messages: [
                {
                    role: 'user',
                    content: [{type: 'text', text: 'Retained request'}],
                    timestamp: 1,
                },
                {
                    role: 'assistant',
                    content: [{type: 'text', text: 'Replacement response'}],
                    provider: 'bkper',
                    model: 'test-model',
                    usage: {
                        input: 1,
                        output: 1,
                        cacheRead: 0,
                        cacheWrite: 0,
                        totalTokens: 2,
                        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0},
                    },
                    stopReason: 'stop',
                    timestamp: 2,
                },
            ],
        });

        await command('Continue from canonical context', context);

        const conversation = generatePrompt.firstCall.args[0].conversation;
        expect(conversation).to.include('Retained request');
        expect(conversation).to.include('Replacement response');
        expect(conversation).not.to.include('Abandoned response');
    });

    it('opens an empty goal editor when /handoff has no goal', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const {command} = registerHandoff(dependencies);
        const context = createCommandContext();
        context.editGoal.resolves({status: 'submitted', text: 'Use my custom goal'});

        await command('', context);

        expect(context.editGoal.calledOnceWithExactly('')).to.equal(true);
        expect(context.editGoal.calledBefore(context.waitForIdle)).to.equal(true);
        expect(
            context.waitForIdle.calledBefore(context.sessionManager.buildSessionProjection)
        ).to.equal(true);
        expect(
            context.sessionManager.buildSessionProjection.calledBefore(generatePrompt)
        ).to.equal(true);
        expect(generatePrompt.firstCall.args[0].goal).to.equal('Use my custom goal');
    });

    for (const cancelledGoal of [undefined, '   ']) {
        it(`cancels without waiting when the goal is ${
            cancelledGoal === undefined ? 'cancelled' : 'empty'
        }`, async function () {
            const {dependencies, generatePrompt} = createDependencies();
            const {command} = registerHandoff(dependencies);
            const context = createCommandContext();
            context.editGoal.resolves(
                cancelledGoal === undefined
                    ? {status: 'cancelled', text: ''}
                    : {status: 'submitted', text: cancelledGoal}
            );

            await command('', context);

            expect(context.waitForIdle.called).to.equal(false);
            expect(context.sessionManager.buildSessionProjection.called).to.equal(false);
            expect(generatePrompt.called).to.equal(false);
            expect(context.newSession.called).to.equal(false);
        });
    }
});
