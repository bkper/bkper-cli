import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {ExtensionAPI, ExtensionContext} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../helpers/test-setup.js';
import {
    AUTO_HANDOFF_LEAD_TOKENS,
    addAutoHandoffSetting,
    calculateAutoHandoffThreshold,
    FileAutoHandoffSettings,
    getAutoHandoffSettingsPath,
    getHandoffReminderThreshold,
    installAutoHandoffSettingsIntegration,
    registerBkperHandoffExtension,
    type AutoHandoffSettings,
    type HandoffDependencies,
    type MutableSettingsList,
} from '../../../src/agent/handoff.js';

type EventHandler = (event: unknown, context: TestContext) => Promise<unknown> | unknown;
type CommandHandler = (args: string, context: TestCommandContext) => Promise<void>;

interface TestContext {
    mode: 'tui';
    model?: {provider: string; id: string};
    ui: {
        editor: sinon.SinonStub;
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

function createMemorySettings(enabled = true): AutoHandoffSettings {
    let current = enabled;
    return {
        isEnabled: () => current,
        setEnabled: value => {
            current = value;
        },
    };
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
    settings = createMemorySettings(),
    dependencies = createDependencies().dependencies,
    reserveTokens = 16_384
): {
    handlers: Map<string, EventHandler>;
    command: CommandHandler;
    sendUserMessage: sinon.SinonStub;
} {
    const handlers = new Map<string, EventHandler>();
    let command: CommandHandler | undefined;
    const sendUserMessage = sinon.stub();

    registerBkperHandoffExtension(
        {
            on: ((event: string, handler: EventHandler) => {
                handlers.set(event, handler);
            }) as unknown as ExtensionAPI['on'],
            registerCommand: ((_name: string, options: {handler: CommandHandler}) => {
                command = options.handler;
            }) as unknown as ExtensionAPI['registerCommand'],
            sendUserMessage,
        },
        settings,
        () => reserveTokens,
        dependencies
    );

    expect(command).to.not.equal(undefined);
    return {handlers, command: command as CommandHandler, sendUserMessage};
}

describe('agent handoff', function () {
    it('places auto-handoff one lead window before auto-compaction', function () {
        expect(calculateAutoHandoffThreshold(128_000, 16_384)).to.equal(103_424);
        expect(getHandoffReminderThreshold(103_424)).to.equal(
            103_424 + AUTO_HANDOFF_LEAD_TOKENS
        );
    });

    it('adds an independent auto-handoff toggle to settings', function () {
        const settings = createMemorySettings();
        const originalChange = sinon.stub();
        const baseItem = {
            id: 'autocompact',
            label: 'Auto-compact',
            currentValue: 'true',
            values: ['true', 'false'],
        };
        const items = [baseItem];
        const settingsList: MutableSettingsList = {
            items,
            filteredItems: items,
            onChange: originalChange,
        };

        addAutoHandoffSetting(settingsList, settings);
        settingsList.onChange('auto-handoff', 'false');
        settingsList.onChange('autocompact', 'false');

        expect(settingsList.items.map(item => item.id)).to.deep.equal([
            'auto-handoff',
            'autocompact',
        ]);
        expect(settings.isEnabled()).to.equal(false);
        expect(originalChange.calledOnceWithExactly('autocompact', 'false')).to.equal(true);
    });

    it('integrates the auto-handoff toggle into the existing settings selector', function () {
        const settings = createMemorySettings();
        const items = [
            {
                id: 'autocompact',
                label: 'Auto-compact',
                currentValue: 'true',
                values: ['true', 'false'],
            },
        ];
        const settingsList: MutableSettingsList = {
            items,
            filteredItems: items,
            onChange: sinon.stub(),
        };
        const host = {
            editorContainer: {children: [] as unknown[]},
            showSettingsSelector() {
                this.editorContainer.children = [
                    {getSettingsList: () => settingsList},
                ];
            },
        };

        installAutoHandoffSettingsIntegration(host, settings);
        host.showSettingsSelector();
        settingsList.onChange('auto-handoff', 'false');

        expect(settingsList.items[0]?.id).to.equal('auto-handoff');
        expect(settings.isEnabled()).to.equal(false);
    });

    it('persists auto-handoff globally and defaults to enabled', function () {
        const directory = mkdtempSync(path.join(tmpdir(), 'bkper-handoff-'));
        const filePath = getAutoHandoffSettingsPath(directory);
        const settings = new FileAutoHandoffSettings(filePath);

        expect(settings.isEnabled()).to.equal(true);
        settings.setEnabled(false);

        expect(new FileAutoHandoffSettings(filePath).isEnabled()).to.equal(false);
        expect(JSON.parse(readFileSync(filePath, 'utf8'))).to.deep.equal({
            autoHandoff: {enabled: false},
        });
    });

    it('uses an explicit goal without opening the goal editor', async function () {
        const {dependencies, generatePrompt} = createDependencies();
        const {command} = registerHandoff(createMemorySettings(), dependencies);
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
        const {command} = registerHandoff(createMemorySettings(), dependencies);
        const context = createCommandContext();
        context.ui.editor.resolves('Use my custom goal');

        await command('', context);

        expect(context.ui.editor.calledOnceWithExactly('Handoff goal', '')).to.equal(true);
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
            const {command} = registerHandoff(createMemorySettings(), dependencies);
            const context = createCommandContext();
            context.ui.editor.resolves(cancelledGoal);

            await command('', context);

            expect(context.waitForIdle.called).to.equal(false);
            expect(context.sessionManager.buildContextEntries.called).to.equal(false);
            expect(generatePrompt.called).to.equal(false);
            expect(context.newSession.called).to.equal(false);
        });
    }

    it('offers auto-handoff at the adaptive threshold and reuses the confirmed goal', async function () {
        const {dependencies} = createDependencies();
        const {handlers, command, sendUserMessage} = registerHandoff(
            createMemorySettings(),
            dependencies
        );
        const context = createContext(103_424);

        await handlers.get('agent_settled')?.({}, context);

        expect(context.ui.editor.calledOnceWithExactly('Handoff goal', '')).to.equal(true);
        expect(sendUserMessage.calledOnceWithExactly('/handoff')).to.equal(true);

        const commandContext = createCommandContext(103_424);
        await command('', commandContext);
    });

    it('snoozes auto-handoff for another lead window after dismissal', async function () {
        const {dependencies} = createDependencies();
        const {handlers} = registerHandoff(createMemorySettings(), dependencies);
        const context = createContext(103_424);
        context.ui.editor.resolves(undefined);
        const belowReminder = createContext(110_000);
        const reminder = createContext(111_616);
        reminder.ui.editor.resolves('Continue in a new session');

        await handlers.get('agent_settled')?.({}, context);
        await handlers.get('agent_settled')?.({}, belowReminder);
        await handlers.get('agent_settled')?.({}, reminder);

        expect(context.ui.editor.calledOnce).to.equal(true);
        expect(belowReminder.ui.editor.called).to.equal(false);
        expect(reminder.ui.editor.calledOnce).to.equal(true);
    });

    it('does not offer automatic handoff when disabled', async function () {
        const {dependencies} = createDependencies();
        const {handlers} = registerHandoff(createMemorySettings(false), dependencies);
        const context = createContext(120_000);

        await handlers.get('agent_settled')?.({}, context);

        expect(context.ui.editor.called).to.equal(false);
    });
});
