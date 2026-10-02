import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    createFauxCore,
    fauxAssistantMessage,
    fauxToolCall,
    getCurrentSystemMessage,
    type AssistantMessage,
    type SystemMessage,
    type TranscriptContext,
} from '@earendil-works/pi-ai';
import {
    createAgentSession,
    DefaultResourceLoader,
    initTheme,
    SessionManager,
    SettingsManager,
    Theme,
    type AgentSession,
    type EntryRenderer,
    type ExtensionAPI,
    type MessageRenderer,
} from '@earendil-works/pi-coding-agent';
import { expect } from '../../helpers/test-setup.js';
import {
    CORE_CONCEPTS_ENTRY_TYPE,
    CORE_CONCEPTS_SECTION,
    detectCoreConceptsPreloadLevel,
    registerBkperCoreConceptsPreloadExtension,
    resolveBkperDocPathFromModuleDir,
} from '../../../../src/agent/extensions/core-concepts-preload.js';

const RELEVANT_PROMPT = 'review tax bot, check code and spot any inconsistency';
const UNRELATED_PROMPT = 'review the README for clarity';
const DOC_PATH = '/docs/core/core-concepts.md';
const CORE_CONCEPTS_MARKDOWN = '# Core Concepts\n\nResources move from one Account to another.';
const DEFINITION = {docPath: DOC_PATH, markdown: CORE_CONCEPTS_MARKDOWN};

const FAUX_PROVIDER = 'bkper-test';
const FAUX_API = 'bkper-test-faux';
const FAUX_MODEL = 'bkper-test-model';

interface TestSession {
    session: AgentSession;
    /** The transcript of every model request, in order. */
    requests: TranscriptContext[];
    /**
     * Starts a run from an extension message, which skips before_agent_start. The model
     * calls a tool first, so Pi rebuilds the prompt before the run's second request.
     */
    triggerExtensionRunWithToolCall(): Promise<void>;
}

/** A real Pi session whose model records each request transcript instead of calling a provider. */
async function createTestSession(settings: Parameters<typeof SettingsManager.inMemory>[0] = {}): Promise<TestSession> {
    const dir = mkdtempSync(path.join(tmpdir(), 'bkper-core-concepts-'));
    const faux = createFauxCore({api: FAUX_API, provider: FAUX_PROVIDER, models: [{id: FAUX_MODEL}]});
    const requests: TranscriptContext[] = [];
    const scripted: AssistantMessage[] = [];
    const respond = (context: TranscriptContext) => {
        requests.push(context);
        faux.appendResponses([respond]);
        return scripted.shift() ?? fauxAssistantMessage('ok');
    };
    faux.setResponses([respond]);

    const settingsManager = SettingsManager.inMemory(settings);
    let extensionApi: ExtensionAPI | undefined;
    const resourceLoader = new DefaultResourceLoader({
        cwd: dir,
        agentDir: dir,
        settingsManager,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        extensionFactories: [
            (pi: ExtensionAPI) => {
                extensionApi = pi;
                pi.registerProvider(FAUX_PROVIDER, {
                    baseUrl: 'http://localhost',
                    apiKey: 'test',
                    api: FAUX_API,
                    streamSimple: faux.streamSimple,
                    models: [{
                        id: FAUX_MODEL,
                        name: 'Test model',
                        reasoning: false,
                        input: ['text'],
                        cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0},
                        contextWindow: 100_000,
                        maxTokens: 1_000,
                    }],
                });
            },
            (pi: ExtensionAPI) => registerBkperCoreConceptsPreloadExtension(pi, DEFINITION),
        ],
    });
    await resourceLoader.reload();

    const {session} = await createAgentSession({
        cwd: dir,
        agentDir: dir,
        resourceLoader,
        settingsManager,
        sessionManager: SessionManager.inMemory(dir),
    });
    const model = session.modelRuntime.getModel(FAUX_PROVIDER, FAUX_MODEL);
    if (!model) {
        throw new Error('Test model is not registered');
    }
    await session.setModel(model);

    const triggerExtensionRunWithToolCall = async (): Promise<void> => {
        scripted.push(fauxAssistantMessage(fauxToolCall('read', {path: 'missing.txt'}), {stopReason: 'toolUse'}));
        const sent = requests.length;
        extensionApi?.sendMessage(
            {customType: 'test-extension', content: 'Extension event.', display: false},
            {triggerTurn: true}
        );
        for (let attempt = 0; attempt < 100 && requests.length < sent + 2; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        await session.waitForIdle();
    };

    return {session, requests, triggerExtensionRunWithToolCall};
}

function isSystemMessage(message: TranscriptContext['messages'][number]): message is SystemMessage {
    return message.role === 'system';
}

function sectionSentIn(request: TranscriptContext | undefined): string | undefined {
    return request
        ? getCurrentSystemMessage(request.messages)?.sections?.[CORE_CONCEPTS_SECTION] ?? undefined
        : undefined;
}

function nonSystemText(request: TranscriptContext): string {
    return JSON.stringify(request.messages.filter(message => message.role !== 'system'));
}

function loadMarkers(session: AgentSession) {
    return session.sessionManager
        .getEntries()
        .filter(entry => entry.type === 'custom' && entry.customType === CORE_CONCEPTS_ENTRY_TYPE);
}

describe('core concepts preload', function () {
    this.timeout(20_000);

    describe('detection', function () {
        it('should classify bot documentation reviews as full preload tasks', function () {
            expect(
                detectCoreConceptsPreloadLevel({
                    prompt: 'review the exchange bot documentation before we publish it',
                })
            ).to.equal('full');
        });

        it('should classify bot code reviews as full preload tasks', function () {
            expect(detectCoreConceptsPreloadLevel({prompt: RELEVANT_PROMPT})).to.equal('full');
        });

        it('should classify Bkper balance questions as full preload tasks', function () {
            expect(
                detectCoreConceptsPreloadLevel({
                    prompt: 'show balances for asset and liability accounts',
                })
            ).to.equal('full');
        });

        it('should skip preload for generic README reviews without Bkper semantics', function () {
            expect(detectCoreConceptsPreloadLevel({prompt: UNRELATED_PROMPT})).to.equal('none');
        });
    });

    describe('doc resolution', function () {
        it('should resolve reference docs from source module directories', function () {
            const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-source-'));
            const moduleDir = path.join(rootDir, 'src', 'agent', 'extensions');
            const coreDir = path.join(rootDir, 'skill', 'references', 'core');
            mkdirSync(moduleDir, {recursive: true});
            mkdirSync(coreDir, {recursive: true});
            writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

            const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

            expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
        });

        it('should resolve docs from built module directories', function () {
            const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-built-'));
            const moduleDir = path.join(rootDir, 'lib', 'agent', 'extensions');
            const coreDir = path.join(rootDir, 'lib', 'docs', 'core');
            mkdirSync(moduleDir, {recursive: true});
            mkdirSync(coreDir, {recursive: true});
            writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

            const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

            expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
        });
    });

    describe('context injection', function () {
        let session: AgentSession | undefined;

        afterEach(function () {
            session?.dispose();
            session = undefined;
        });

        it('should ground an accounting prompt through the system prompt, not the conversation', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(RELEVANT_PROMPT);

            const sent = sectionSentIn(test.requests[0]);
            expect(sent).to.include(CORE_CONCEPTS_MARKDOWN);
            expect(sent).to.include(DOC_PATH);
            expect(nonSystemText(test.requests[0]!)).to.not.include('Resources move from one Account');
        });

        it('should not load the section for prompts without Bkper semantics', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(UNRELATED_PROMPT);

            expect(sectionSentIn(test.requests[0])).to.equal(undefined);
        });

        it('should keep the section for the rest of the session once loaded', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(RELEVANT_PROMPT);
            await session.prompt(UNRELATED_PROMPT);

            expect(sectionSentIn(test.requests[1])).to.include(CORE_CONCEPTS_MARKDOWN);
            const sectionPatches = test.requests[1]!.messages
                .filter(isSystemMessage)
                .map(message => message.sections?.[CORE_CONCEPTS_SECTION]);
            expect(sectionPatches).to.not.include(null);
        });

        it('should append the section mid-session without changing the earlier transcript', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(UNRELATED_PROMPT);
            await session.prompt(RELEVANT_PROMPT);

            const [first, second] = test.requests;
            expect(sectionSentIn(first)).to.equal(undefined);
            expect(sectionSentIn(second)).to.include(CORE_CONCEPTS_MARKDOWN);
            // The first request is an unchanged prefix of the second, so it stays cacheable.
            expect(second!.messages.slice(0, first!.messages.length)).to.deep.equal(first!.messages);
        });

        it('should keep the section after compaction', async function () {
            // Keep only the latest turn, so compaction summarizes the turn that loaded the section.
            const test = await createTestSession({compaction: {keepRecentTokens: 1}});
            session = test.session;

            await session.prompt(RELEVANT_PROMPT);
            await session.prompt('and the receivables too');
            await session.compact();
            await session.prompt(UNRELATED_PROMPT);

            const last = test.requests.at(-1)!;
            expect(nonSystemText(last)).to.not.include(RELEVANT_PROMPT);
            expect(sectionSentIn(last)).to.include(CORE_CONCEPTS_MARKDOWN);
        });

        it('should restore the section after a turn that skipped it, even without Bkper semantics', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(RELEVANT_PROMPT);
            await test.triggerExtensionRunWithToolCall();
            await session.prompt(UNRELATED_PROMPT);

            expect(sectionSentIn(test.requests.at(-1))).to.include(CORE_CONCEPTS_MARKDOWN);
        });

        it('should mark the load once in the session, after the prompt that loaded it', async function () {
            const test = await createTestSession();
            session = test.session;

            await session.prompt(UNRELATED_PROMPT);
            await session.prompt(RELEVANT_PROMPT);
            await session.prompt(RELEVANT_PROMPT);

            expect(loadMarkers(session)).to.have.length(1);
            const entries = session.sessionManager.getEntries();
            const markerIndex = entries.indexOf(loadMarkers(session)[0]!);
            const previous = entries[markerIndex - 1];
            expect(previous?.type === 'message' && previous.message.role).to.equal('user');
        });
    });

    describe('load marker rendering', function () {
        before(function () {
            initTheme('dark', false);
        });

        type ThemeFgColors = ConstructorParameters<typeof Theme>[0];
        type ThemeBgColors = ConstructorParameters<typeof Theme>[1];

        const PI_DARK_THEME_PATH = path.resolve(
            import.meta.dirname,
            '../../../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json'
        );

        /** A theme with every color key Pi's bundled theme defines, all mapped to one plain color. */
        function createPlainTheme(): Theme {
            const themeJson: {colors: Record<string, unknown>} = JSON.parse(readFileSync(PI_DARK_THEME_PATH, 'utf8'));
            const colors = Object.fromEntries(Object.keys(themeJson.colors).map(key => [key, 7]));
            return new Theme(colors as ThemeFgColors, colors as ThemeBgColors, '256color');
        }

        type Rendered = {render(width: number): string[]} | undefined;

        function registerRenderers(): {
            renderMarker: (expanded: boolean) => Rendered;
            renderLegacyMessage: (expanded: boolean) => Rendered;
        } {
            const entryRenderers = new Map<string, EntryRenderer>();
            const messageRenderers = new Map<string, MessageRenderer>();
            registerBkperCoreConceptsPreloadExtension(
                {
                    on: (() => () => undefined) as ExtensionAPI['on'],
                    appendEntry: () => undefined,
                    registerEntryRenderer: <T>(customType: string, renderer: EntryRenderer<T>) => {
                        entryRenderers.set(customType, (entry, options, theme) =>
                            renderer({...entry, data: undefined}, options, theme)
                        );
                    },
                    registerMessageRenderer: <T>(customType: string, renderer: MessageRenderer<T>) => {
                        messageRenderers.set(customType, (message, options, theme) =>
                            renderer({...message, details: undefined}, options, theme)
                        );
                    },
                },
                DEFINITION
            );
            return {
                renderMarker: expanded => entryRenderers.get(CORE_CONCEPTS_ENTRY_TYPE)?.(
                    {type: 'custom', customType: CORE_CONCEPTS_ENTRY_TYPE, id: 'marker', parentId: null, timestamp: ''},
                    {expanded},
                    createPlainTheme()
                ),
                // Sessions saved before the section existed carry the doc as a custom message.
                renderLegacyMessage: expanded => messageRenderers.get(CORE_CONCEPTS_ENTRY_TYPE)?.(
                    {
                        role: 'custom',
                        customType: CORE_CONCEPTS_ENTRY_TYPE,
                        content: `## Bkper Core Concepts\n\n${CORE_CONCEPTS_MARKDOWN}`,
                        display: true,
                        timestamp: 0,
                    },
                    {expanded, outputPad: 1},
                    createPlainTheme()
                ),
            };
        }

        function visibleText(component: Rendered): string {
            expect(component).to.not.equal(undefined);
            // Strip ANSI styling so assertions check visible text only.
            return (component?.render(120) ?? []).join('\n').replace(/\x1b\[[0-9;]*m/g, '');
        }

        function renderMarker(expanded: boolean): string {
            return visibleText(registerRenderers().renderMarker(expanded));
        }

        it('should render core concepts messages from earlier sessions as the same collapsed read row', function () {
            const output = visibleText(registerRenderers().renderLegacyMessage(false));

            expect(output).to.include('read');
            expect(output).to.include(DOC_PATH);
            expect(output).to.not.include('Resources move from one Account to another.');
        });

        it('should render collapsed like a read tool call showing only the doc path', function () {
            const output = renderMarker(false);

            expect(output).to.include('read');
            expect(output).to.include(DOC_PATH);
            expect(output).to.not.include('Resources move from one Account to another.');
        });

        it('should render the doc content when expanded', function () {
            const output = renderMarker(true);

            expect(output).to.include(DOC_PATH);
            expect(output).to.include('Resources move from one Account to another.');
        });
    });
});
