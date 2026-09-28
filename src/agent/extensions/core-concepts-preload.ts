import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createReadToolDefinition,
    type BeforeAgentStartEventResult,
    type ExtensionAPI,
    type MessageRenderer,
    type ReadToolInput,
} from '@earendil-works/pi-coding-agent';
import { Box } from '@earendil-works/pi-tui';

const DOCS_PATTERN =
    /\b(doc|docs|documentation|readme|guide|guides|example|examples|spec|specs|reference)\b/i;
const ANALYSIS_PATTERN =
    /\b(review|audit|validate|verify|critique|rewrite|document|describe|explain|design|model|map|check|spot)\b/i;
const AUTOMATION_PATTERN = /\b(bot|bots|app|apps|automation|automations)\b/i;
const SEMANTIC_PATTERN =
    /\b(bkper|book|books|account|accounts|group|groups|transaction|transactions|balance|balances|incoming|outgoing|asset|assets|liability|liabilities|receivable|receivables|payable|payables|statement|statements|ledger|flow|flows|movement|movements|collection|collections|tax)\b/i;

export type CoreConceptsPreloadLevel = 'none' | 'full';

export interface CoreConceptsPreloadDefinition {
    docPath: string;
    markdown: string;
}

export interface CoreConceptsPreloadInput {
    prompt: string;
}

export type CoreConceptsPreloadResult = BeforeAgentStartEventResult;

export const CORE_CONCEPTS_MESSAGE_TYPE = 'bkper-core-concepts';

type ReadToolDefinition = ReturnType<typeof createReadToolDefinition>;
type ReadToolRenderContext = Parameters<NonNullable<ReadToolDefinition['renderCall']>>[2];

type ContextEntryLike = {
    type: string;
    customType?: string;
};

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

export function detectCoreConceptsPreloadLevel(
    input: CoreConceptsPreloadInput
): CoreConceptsPreloadLevel {
    const prompt = input.prompt.trim();
    if (!prompt) {
        return 'none';
    }

    const hasDocs = DOCS_PATTERN.test(prompt);
    const hasAnalysis = ANALYSIS_PATTERN.test(prompt);
    const hasAutomation = AUTOMATION_PATTERN.test(prompt);
    const hasSemantic = SEMANTIC_PATTERN.test(prompt);

    if ((hasDocs || hasAnalysis) && (hasAutomation || hasSemantic)) {
        return 'full';
    }

    if (hasSemantic) {
        return 'full';
    }

    return 'none';
}

function buildCoreConceptsMessageContent(definition: CoreConceptsPreloadDefinition): string {
    return `## Bkper Core Concepts\nLoaded from \`${definition.docPath}\`. Base all reasoning about Bkper data on this reference.\n\n${definition.markdown}`;
}

function hasCoreConceptsInContext(entries: ContextEntryLike[]): boolean {
    return entries.some(
        entry => entry.type === 'custom_message' && entry.customType === CORE_CONCEPTS_MESSAGE_TYPE
    );
}

/**
 * Renders the injected message with Pi's own read tool renderers, so it looks
 * like a read of the doc: collapsed shows the path, expanded shows the content.
 */
function createCoreConceptsMessageRenderer(definition: CoreConceptsPreloadDefinition): MessageRenderer {
    return (_message, options, theme) => {
        const cwd = process.cwd();
        const read = createReadToolDefinition(cwd);
        if (!read.renderCall || !read.renderResult) {
            return undefined;
        }

        const args: ReadToolInput = {path: definition.docPath};
        const context: ReadToolRenderContext = {
            args,
            toolCallId: CORE_CONCEPTS_MESSAGE_TYPE,
            invalidate: () => undefined,
            lastComponent: undefined,
            state: {},
            cwd,
            executionStarted: true,
            argsComplete: true,
            isPartial: false,
            expanded: options.expanded,
            showImages: false,
            isError: false,
        };

        // Same shell Pi uses for a successful tool row.
        const box = new Box(1, 1, text => theme.bg('toolSuccessBg', text));
        box.addChild(read.renderCall(args, theme, context));
        box.addChild(
            read.renderResult(
                {content: [{type: 'text', text: definition.markdown}], details: undefined},
                {expanded: options.expanded, isPartial: false},
                theme,
                context
            )
        );
        return box;
    };
}

export function registerBkperCoreConceptsPreloadExtension(
    pi: Pick<ExtensionAPI, 'on' | 'registerMessageRenderer'>,
    definition: CoreConceptsPreloadDefinition = getDefaultCoreConceptsPreloadDefinition()
): void {
    pi.registerMessageRenderer(CORE_CONCEPTS_MESSAGE_TYPE, createCoreConceptsMessageRenderer(definition));

    pi.on('before_agent_start', (event, ctx) => {
        if (detectCoreConceptsPreloadLevel({prompt: event.prompt}) === 'none') {
            return undefined;
        }

        // Compaction-aware: content summarized away by compaction is injected again.
        if (hasCoreConceptsInContext(ctx.sessionManager.buildContextEntries())) {
            return undefined;
        }

        return {
            message: {
                customType: CORE_CONCEPTS_MESSAGE_TYPE,
                content: buildCoreConceptsMessageContent(definition),
                display: true,
            },
        };
    });
}
