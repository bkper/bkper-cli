import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    initTheme,
    Theme,
    type ExtensionAPI,
    type MessageRenderer,
    type MessageRenderOptions,
} from '@earendil-works/pi-coding-agent';
import type { Component } from '@earendil-works/pi-tui';
import { expect } from '../../helpers/test-setup.js';
import {
    CORE_CONCEPTS_MESSAGE_TYPE,
    detectCoreConceptsPreloadLevel,
    registerBkperCoreConceptsPreloadExtension,
    resolveBkperDocPathFromModuleDir,
    type CoreConceptsPreloadResult,
} from '../../../../src/agent/extensions/core-concepts-preload.js';

type ContextEntryLike = {
    type: string;
    customType?: string;
};

type PreloadContextLike = {
    sessionManager: {
        buildContextEntries(): ContextEntryLike[];
    };
};

type RegisteredBeforeAgentStartHandler = (
    event: {
        prompt: string;
        systemPrompt: string;
    },
    context: PreloadContextLike
) => Promise<CoreConceptsPreloadResult | void> | CoreConceptsPreloadResult | void;

const REVIEW_PROMPT = 'review tax bot, check code and spot any inconsistency';
const DOC_PATH = '/docs/core/core-concepts.md';
const CORE_CONCEPTS_MARKDOWN = '# Core Concepts\n\nResources move from one Account to another.';

function relevantEvent() {
    return {prompt: REVIEW_PROMPT, systemPrompt: 'Base prompt'};
}

function contextWith(entries: ContextEntryLike[]): PreloadContextLike {
    return {sessionManager: {buildContextEntries: () => entries}};
}

function injectedEntry(): ContextEntryLike {
    return {type: 'custom_message', customType: CORE_CONCEPTS_MESSAGE_TYPE};
}

type InjectedMessage = NonNullable<CoreConceptsPreloadResult['message']>;

type RenderInjectedMessage = (
    message: InjectedMessage,
    options: MessageRenderOptions,
    theme: Theme
) => Component | undefined;

type RegisteredPreloadExtension = {
    beforeAgentStart: RegisteredBeforeAgentStartHandler;
    renderMessage: RenderInjectedMessage;
};

function registerPreloadExtensionHandlers(): RegisteredPreloadExtension {
    let beforeAgentStartHandler: RegisteredBeforeAgentStartHandler | undefined;
    const registeredEvents: string[] = [];
    const renderers = new Map<string, RenderInjectedMessage>();

    registerBkperCoreConceptsPreloadExtension(
        {
            on: ((event: string, handler: unknown) => {
                registeredEvents.push(event);
                if (event === 'before_agent_start') {
                    beforeAgentStartHandler = handler as RegisteredBeforeAgentStartHandler;
                }
            }) as ExtensionAPI['on'],
            registerMessageRenderer: <T>(customType: string, renderer: MessageRenderer<T>) => {
                renderers.set(customType, (message, options, theme) =>
                    renderer(
                        {
                            role: 'custom',
                            timestamp: 0,
                            customType: message.customType,
                            content: message.content,
                            display: message.display,
                        },
                        options,
                        theme
                    )
                );
            },
        },
        {docPath: DOC_PATH, markdown: CORE_CONCEPTS_MARKDOWN}
    );

    expect(registeredEvents).to.deep.equal(['before_agent_start']);
    expect(beforeAgentStartHandler).to.not.equal(undefined);
    const renderMessage = renderers.get(CORE_CONCEPTS_MESSAGE_TYPE);
    expect(renderMessage).to.not.equal(undefined);

    return {
        beforeAgentStart: beforeAgentStartHandler as RegisteredBeforeAgentStartHandler,
        renderMessage: renderMessage as RenderInjectedMessage,
    };
}

function registerPreloadExtension(): RegisteredBeforeAgentStartHandler {
    return registerPreloadExtensionHandlers().beforeAgentStart;
}

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

async function renderInjectedMessage(expanded: boolean): Promise<string> {
    const {beforeAgentStart, renderMessage} = registerPreloadExtensionHandlers();
    const result = await beforeAgentStart(relevantEvent(), contextWith([]));
    const message = result?.message;
    expect(message).to.not.equal(undefined);
    if (!message) {
        return '';
    }

    const component = renderMessage(
        message,
        {expanded, outputPad: 1},
        createPlainTheme()
    );
    expect(component).to.not.equal(undefined);

    // Strip ANSI styling so assertions check visible text only.
    return (component?.render(120) ?? []).join('\n').replace(/\x1b\[[0-9;]*m/g, '');
}

describe('core concepts preload', function () {
    it('should classify bot documentation reviews as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'review the exchange bot documentation before we publish it',
            })
        ).to.equal('full');
    });

    it('should classify bot code reviews as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: REVIEW_PROMPT,
            })
        ).to.equal('full');
    });

    it('should classify Bkper balance questions as full preload tasks', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'show balances for asset and liability accounts',
            })
        ).to.equal('full');
    });

    it('should skip preload for generic README reviews without Bkper semantics', function () {
        expect(
            detectCoreConceptsPreloadLevel({
                prompt: 'review the README for clarity',
            })
        ).to.equal('none');
    });

    it('should resolve reference docs from source module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-source-'));
        const moduleDir = path.join(rootDir, 'src', 'agent', 'extensions');
        const referencesDir = path.join(rootDir, 'skill', 'references');
        const coreDir = path.join(referencesDir, 'core');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(coreDir, {recursive: true});
        writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

        expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
    });

    it('should resolve docs from built module directories', function () {
        const rootDir = mkdtempSync(path.join(tmpdir(), 'bkper-cli-built-'));
        const moduleDir = path.join(rootDir, 'lib', 'agent', 'extensions');
        const docsDir = path.join(rootDir, 'lib', 'docs');
        const coreDir = path.join(docsDir, 'core');
        mkdirSync(moduleDir, {recursive: true});
        mkdirSync(coreDir, {recursive: true});
        writeFileSync(path.join(coreDir, 'core-concepts.md'), '# Core Concepts');

        const docPath = resolveBkperDocPathFromModuleDir(moduleDir, 'core/core-concepts.md');

        expect(docPath).to.equal(path.join(coreDir, 'core-concepts.md'));
    });

    it('should inject the core concepts content on the first relevant turn', async function () {
        const beforeAgentStart = registerPreloadExtension();

        const result = await beforeAgentStart(relevantEvent(), contextWith([]));

        expect(result?.message?.customType).to.equal(CORE_CONCEPTS_MESSAGE_TYPE);
        expect(result?.message?.content).to.include(CORE_CONCEPTS_MARKDOWN);
        expect(result?.message?.content).to.include(DOC_PATH);
        expect(result?.systemPrompt).to.equal(undefined);
    });

    it('should not inject on turns without Bkper semantics', async function () {
        const beforeAgentStart = registerPreloadExtension();

        const result = await beforeAgentStart(
            {prompt: 'review the README for clarity', systemPrompt: 'Base prompt'},
            contextWith([])
        );

        expect(result).to.equal(undefined);
    });

    it('should not inject again while the content is in the model context', async function () {
        const beforeAgentStart = registerPreloadExtension();

        const result = await beforeAgentStart(
            relevantEvent(),
            contextWith([{type: 'message'}, injectedEntry()])
        );

        expect(result).to.equal(undefined);
    });

    it('should inject again once compaction removed the content from the model context', async function () {
        const beforeAgentStart = registerPreloadExtension();

        await beforeAgentStart(relevantEvent(), contextWith([]));
        const result = await beforeAgentStart(
            relevantEvent(),
            contextWith([{type: 'compaction'}, {type: 'message'}])
        );

        expect(result?.message?.customType).to.equal(CORE_CONCEPTS_MESSAGE_TYPE);
    });

    it('should ignore custom messages from other extensions', async function () {
        const beforeAgentStart = registerPreloadExtension();

        const result = await beforeAgentStart(
            relevantEvent(),
            contextWith([{type: 'custom_message', customType: 'other-extension'}])
        );

        expect(result?.message?.customType).to.equal(CORE_CONCEPTS_MESSAGE_TYPE);
    });

    describe('message rendering', function () {
        before(function () {
            initTheme('dark', false);
        });

        it('should render collapsed like a read tool call showing only the doc path', async function () {
            const output = await renderInjectedMessage(false);

            expect(output).to.include('read');
            expect(output).to.include(DOC_PATH);
            expect(output).to.not.include('Resources move from one Account to another.');
        });

        it('should render the doc content when expanded', async function () {
            const output = await renderInjectedMessage(true);

            expect(output).to.include(DOC_PATH);
            expect(output).to.include('Resources move from one Account to another.');
        });
    });
});
