import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createReadToolDefinition,
    type EntryRenderer,
    type EntryRenderOptions,
    type ExtensionAPI,
    type ExtensionContext,
    type MessageRenderer,
    type MessageRenderOptions,
    type MessageStartEvent,
    type ReadToolInput,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import { Box } from '../pi-shared-modules.js';
import {CORE_CONCEPTS_ROUTE} from '../core-concepts-routing.js';
import {registerPromptRoutingExtension, type PromptLoaderRouter} from './prompt-routing.js';

export {detectCoreConceptsPreloadLevel} from '../core-concepts-routing.js';
export type {CoreConceptsPreloadInput, CoreConceptsPreloadLevel} from '../core-concepts-routing.js';

export interface CoreConceptsPreloadDefinition {
    docPath: string;
    markdown: string;
}

/** System prompt section that grounds the session in the Bkper data model. */
export const CORE_CONCEPTS_SECTION = 'bkper-core-concepts';

/**
 * Display-only session entry marking where the section was loaded. Never sent to the model.
 * Sessions saved before the section existed carry custom messages of the same type.
 */
export const CORE_CONCEPTS_ENTRY_TYPE = 'bkper-core-concepts';

type ReadToolDefinition = ReturnType<typeof createReadToolDefinition>;
type ReadToolRenderContext = Parameters<NonNullable<ReadToolDefinition['renderCall']>>[2];

export function resolveBkperDocPathFromModuleDir(
    moduleDir: string,
    relativePath: string
): string {
    const candidates = [
        path.resolve(moduleDir, '..', '..', 'docs', relativePath),
        path.resolve(moduleDir, '..', '..', '..', 'skill', 'references', relativePath),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}

function resolveDocPath(relativePath: string): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return resolveBkperDocPathFromModuleDir(thisDir, relativePath);
}

export function getCoreConceptsDocPath(): string {
    return resolveDocPath('core/core-concepts.md');
}

export function getDefaultCoreConceptsPreloadDefinition(): CoreConceptsPreloadDefinition {
    const docPath = getCoreConceptsDocPath();
    return {
        docPath,
        markdown: readFileSync(docPath, 'utf8'),
    };
}

function buildCoreConceptsSection(definition: CoreConceptsPreloadDefinition): string {
    return `Loaded from \`${definition.docPath}\`. Base all reasoning about Bkper data on this reference.\n\n${definition.markdown}`;
}

/**
 * Whether the section was loaded in this branch, replayed from the transcript's system
 * messages. Compaction checkpoints carry the replayed sections, so this survives
 * compaction, resume, and branch navigation. A load that Pi later removed still counts:
 * runs started without before_agent_start, such as extension-triggered turns, rebuild
 * the prompt without the section, and the next prompt must restore it.
 */
function wasCoreConceptsLoaded(ctx: ExtensionContext): boolean {
    const messages = ctx.sessionManager.buildSessionProjection().messages;
    return messages.some(
        message =>
            message.role === 'system' && typeof message.sections?.[CORE_CONCEPTS_SECTION] === 'string'
    );
}

/**
 * Renders the doc with Pi's own read tool renderers, so it looks like a read of the
 * doc: collapsed shows the path, expanded shows the content.
 */
function renderCoreConceptsRead(
    definition: CoreConceptsPreloadDefinition,
    expanded: boolean,
    theme: Theme
): Box | undefined {
    const cwd = process.cwd();
    const read = createReadToolDefinition(cwd);
    if (!read.renderCall || !read.renderResult) {
        return undefined;
    }

    const args: ReadToolInput = {path: definition.docPath};
    const context: ReadToolRenderContext = {
        args,
        toolCallId: CORE_CONCEPTS_ENTRY_TYPE,
        invalidate: () => undefined,
        lastComponent: undefined,
        state: {},
        cwd,
        executionStarted: true,
        argsComplete: true,
        isPartial: false,
        expanded,
        showImages: false,
        isError: false,
    };

    // Same shell Pi uses for a successful tool row.
    const box = new Box(1, 1, (text: string) => theme.bg('toolSuccessBg', text));
    box.addChild(read.renderCall(args, theme, context));
    box.addChild(
        read.renderResult(
            {content: [{type: 'text', text: definition.markdown}], details: undefined},
            {expanded, isPartial: false},
            theme,
            context
        )
    );
    return box;
}

function createCoreConceptsEntryRenderer(definition: CoreConceptsPreloadDefinition): EntryRenderer {
    return (_entry: Parameters<EntryRenderer>[0], options: EntryRenderOptions, theme: Theme) =>
        renderCoreConceptsRead(definition, options.expanded, theme);
}

function createLegacyCoreConceptsMessageRenderer(
    definition: CoreConceptsPreloadDefinition
): MessageRenderer {
    return (_message: Parameters<MessageRenderer>[0], options: MessageRenderOptions, theme: Theme) =>
        renderCoreConceptsRead(definition, options.expanded, theme);
}

/**
 * Grounds accounting and finance sessions in the Bkper data model through a system
 * prompt section. Once loaded, the section is kept for the rest of the session: Pi
 * rebuilds the prompt from its base options on every prompt, so a section that is
 * not set again would be removed. Pi appends the section as a mid-conversation
 * system message, which keeps the cached prefix on models that accept those messages.
 */
export function registerBkperCoreConceptsPreloadExtension(
    pi: Pick<ExtensionAPI, 'on' | 'registerEntryRenderer' | 'registerMessageRenderer' | 'appendEntry'>,
    definition: CoreConceptsPreloadDefinition = getDefaultCoreConceptsPreloadDefinition(),
    router: PromptLoaderRouter = registerPromptRoutingExtension(pi)
): void {
    const section = buildCoreConceptsSection(definition);
    let markLoad = false;

    pi.registerEntryRenderer(CORE_CONCEPTS_ENTRY_TYPE, createCoreConceptsEntryRenderer(definition));
    pi.registerMessageRenderer(
        CORE_CONCEPTS_ENTRY_TYPE,
        createLegacyCoreConceptsMessageRenderer(definition)
    );

    router.registerLoader({
        ...CORE_CONCEPTS_ROUTE,
        isLoaded: wasCoreConceptsLoaded,
        apply(event, _ctx, load, alreadyLoaded) {
            markLoad = false;
            if (!load) return;
            event.systemPromptOptions.sections[CORE_CONCEPTS_SECTION] = section;
            markLoad = !alreadyLoaded;
        },
    });

    // The user prompt is persisted once its message ends, so the first assistant
    // message is the earliest point where the marker lands after the prompt.
    pi.on('message_start', (event: MessageStartEvent) => {
        if (!markLoad || event.message.role !== 'assistant') {
            return;
        }
        markLoad = false;
        pi.appendEntry(CORE_CONCEPTS_ENTRY_TYPE);
    });
}
