import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

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

export interface CoreConceptsPreloadResult {
    systemPrompt?: string;
}

type ReadToolInput = {
    path?: unknown;
};

type ToolCallEventLike = {
    toolName: string;
    input: Record<string, unknown>;
};

function resolveDocPath(filename: string): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', 'docs', filename);
}

function normalizePath(filePath: string): string {
    return path.resolve(filePath);
}

function getReadToolPath(input: Record<string, unknown>): string | undefined {
    const maybeReadInput = input as ReadToolInput;
    return typeof maybeReadInput.path === 'string' ? normalizePath(maybeReadInput.path) : undefined;
}

export function getCoreConceptsDocPath(): string {
    return resolveDocPath('core-concepts.md');
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

export function buildCoreConceptsReadInstruction(coreConceptsPath: string): string {
    return `## Mandatory Bkper Core Concepts Read\nBefore doing anything else for this task, use the \`read\` tool to load the Bkper core concepts from:\n\n\`\`\`\n${coreConceptsPath}\n\`\`\`\n\nRead this file before any other tool call or substantive response. After reading it, continue normally.`;
}

function buildCoreConceptsPreloadResult(
    systemPrompt: string,
    definition: CoreConceptsPreloadDefinition
): CoreConceptsPreloadResult {
    return {
        systemPrompt: `${systemPrompt}\n\n${buildCoreConceptsReadInstruction(definition.docPath)}`,
    };
}

function shouldAllowReadToolCall(event: ToolCallEventLike, definition: CoreConceptsPreloadDefinition): boolean {
    return event.toolName === 'read' && getReadToolPath(event.input) === normalizePath(definition.docPath);
}

export function registerBkperCoreConceptsPreloadExtension(
    pi: Pick<ExtensionAPI, 'on'>,
    definition: CoreConceptsPreloadDefinition = getDefaultCoreConceptsPreloadDefinition()
): void {
    let hasLoadedCoreConcepts = false;
    let pendingCoreConceptsRead = false;

    pi.on('before_agent_start', event => {
        if (hasLoadedCoreConcepts || detectCoreConceptsPreloadLevel({prompt: event.prompt}) === 'none') {
            pendingCoreConceptsRead = false;
            return undefined;
        }

        pendingCoreConceptsRead = true;
        return buildCoreConceptsPreloadResult(event.systemPrompt, definition);
    });

    pi.on('tool_call', event => {
        if (!pendingCoreConceptsRead) {
            return undefined;
        }

        if (shouldAllowReadToolCall(event, definition)) {
            pendingCoreConceptsRead = false;
            hasLoadedCoreConcepts = true;
            return undefined;
        }

        return {
            block: true as const,
            reason: `First use read on ${definition.docPath} before other tools.`,
        };
    });

    pi.on('agent_end', () => {
        pendingCoreConceptsRead = false;
    });
}
