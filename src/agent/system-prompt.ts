import {
    createBashToolDefinition,
    createCodemodeExtension,
    createEditToolDefinition,
    createPowerShellToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
    type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveFirstExistingPath(candidates: string[]): string {
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
}

function resolveDocsIndexPath(filename: string): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return resolveFirstExistingPath([
        path.resolve(thisDir, '..', 'docs', filename),
        path.resolve(thisDir, '..', '..', 'skill', 'references', filename),
    ]);
}

function resolvePiPackageRoot(): string {
    const piIndexPath = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
    let dir = path.dirname(piIndexPath);
    while (dir !== path.dirname(dir)) {
        if (existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return path.dirname(piIndexPath);
}

function normalizePromptSnippet(text: string | undefined): string | undefined {
    if (!text) {
        return undefined;
    }
    const oneLine = text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return oneLine.length > 0 ? oneLine : undefined;
}

function normalizePromptGuidelines(guidelines: string[] | undefined): string[] {
    if (!guidelines || guidelines.length === 0) {
        return [];
    }
    const unique = new Set<string>();
    for (const guideline of guidelines) {
        const normalized = guideline.trim();
        if (normalized.length > 0) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}

function getCodingToolDefinitions(selectedTools: string[]) {
    return [
        createReadToolDefinition(process.cwd()),
        createBashToolDefinition(process.cwd()),
        createPowerShellToolDefinition(process.cwd()),
        createEditToolDefinition(process.cwd()),
        createWriteToolDefinition(process.cwd()),
    ].filter(definition => selectedTools.includes(definition.name));
}

interface ToolPromptContribution {
    snippet?: string;
    guidelines: string[];
}

/**
 * Pi exports codemode only as an extension factory, not its tool definition, so the snippet
 * and guidelines are read from the definition the factory registers. The factory calls nothing
 * but registerTool while registering; settings and session entries are read later, in closures.
 */
function getCodemodePromptContribution(): ToolPromptContribution {
    const contribution: ToolPromptContribution = {guidelines: []};
    const registrar: Pick<ExtensionAPI, 'registerTool'> = {
        registerTool: tool => {
            contribution.snippet = normalizePromptSnippet(tool.promptSnippet);
            contribution.guidelines = normalizePromptGuidelines(tool.promptGuidelines);
        },
    };
    void createCodemodeExtension()(registrar as ExtensionAPI);
    return contribution;
}

// Bkper's additions to Pi's codemode guidelines.
function getBkperCodemodeGuidelines(codemodeDocsPath: string): string[] {
    return [
        'Use codemode, not shell loops or jq pipelines, to repeat commands across items.',
        `For judgments across many items — rank, score, classify, or filter by sentiment, urgency, relevance, or quality — do not read the items yourself: in one codemode script, load them, run a classifier with models.classify() per item, and return only counts and the selected items. Read ${codemodeDocsPath} first; find classifiers with models.getAvailableOfType("classifier").`,
        'Book writes in a codemode script need the same confirmation as single commands: resolve targets read-only, show the script and changes, run only after the user confirms, and report each item\'s result.',
    ];
}

function buildToolPromptSection(selectedTools: string[]): string {
    // Pi drops tool prompt snippets and guidelines when the system prompt is replaced, so
    // Bkper adds them from the tool definitions.
    const toolDefinitions = getCodingToolDefinitions(selectedTools);
    const codemode = selectedTools.includes('codemode')
        ? getCodemodePromptContribution()
        : undefined;
    const toolLines = [
        ...toolDefinitions.flatMap(definition => {
            const snippet = normalizePromptSnippet(definition.promptSnippet);
            return snippet ? [`- ${definition.name}: ${snippet}`] : [];
        }),
        ...(codemode?.snippet ? [`- codemode: ${codemode.snippet}`] : []),
    ].join('\n');

    const guidelineLines: string[] = [];
    const seenGuidelines = new Set<string>();
    const addGuideline = (guideline: string) => {
        const normalized = guideline.trim();
        if (normalized.length === 0 || seenGuidelines.has(normalized)) {
            return;
        }
        seenGuidelines.add(normalized);
        guidelineLines.push(`- ${normalized}`);
    };

    if (selectedTools.includes('powershell')) {
        addGuideline(
            'Use PowerShell for file operations like listing, searching, and finding files. Use it to run bkper CLI commands when relevant.'
        );
    } else if (selectedTools.includes('bash')) {
        addGuideline(
            'Use bash for discovery and search like ls, rg, and find. Use it to run bkper CLI commands when relevant.'
        );
    }
    for (const definition of toolDefinitions) {
        for (const guideline of normalizePromptGuidelines(definition.promptGuidelines)) {
            addGuideline(guideline);
        }
    }
    if (codemode) {
        codemode.guidelines.forEach(addGuideline);
        getBkperCodemodeGuidelines(
            path.resolve(resolvePiPackageRoot(), 'docs', 'codemode.md')
        ).forEach(addGuideline);
    }
    addGuideline('Do not claim builds, tests, or command results unless you actually ran them.');

    const toolsList = toolLines.length > 0 ? toolLines : '(none)';
    return `Available tools:\n${toolsList}\n\nIn addition to the tools above, you may have access to other custom tools depending on the project.\n\nGuidelines:\n${guidelineLines.join(
        '\n'
    )}`;
}

export function getBkperAgentSystemPrompt(
    selectedTools: string[] = ['read', 'bash', 'edit', 'write']
): string {
    const coreConceptsPath = resolveDocsIndexPath('core/core-concepts.md');
    const indexPath = resolveDocsIndexPath('index.md');
    const referenceDocsDir = path.dirname(indexPath);
    const piRoot = resolvePiPackageRoot();
    const piDocsPath = path.resolve(piRoot, 'docs');
    const piExamplesPath = path.resolve(piRoot, 'examples');
    return `${buildBkperOperatingContext(selectedTools)}
## Required Reading

Bkper's accounting model is intentionally non-standard. Generic accounting knowledge — debit/credit, account categories, sign conventions — will lead you to wrong answers here.

The canonical Bkper data model reference:

\`\`\`
${coreConceptsPath}
\`\`\`

Base all reasoning about Bkper data — books, accounts, groups, transactions, balances, queries, or any accounting or financial flow — on this reference. Prior accounting intuition does not substitute for it.

## Reference Routing

- Read local \`AGENTS.md\`, nearby files, and existing tests first for project-specific work.
- For any Bkper or adjacent accounting-support task — CLI usage, SDK code, data management, App creation and development, financial reports, taxes, or accountant recommendations — read the docs index and then load the specific doc(s) it points to based on the task:

\`\`\`
${indexPath}
\`\`\`
Reference docs named by the index are available in:

\`\`\`
${referenceDocsDir}
\`\`\`
- ALWAYS read index docs and follow references to specific docs before running any bkper CLI command.
- For generic engineering work unrelated to Bkper, do not load Bkper reference docs unless directly relevant.
- When scope is unclear, inspect local files and project instructions first; load reference docs only after identifying a concrete need.
- If the task involves building or debugging pi extensions, custom tools, themes, or skills — read the pi docs directory and follow cross-references within. Pi CLI commands in those docs run as \`bkper agent <command>\` (for example, \`pi mcp add\` is \`bkper agent mcp add\`):

\`\`\`
${piDocsPath}
\`\`\`

Check extension examples at:

\`\`\`
${piExamplesPath}
\`\`\`

- For anything not covered by the local docs index, fetch and read:

  https://bkper.com/llms.txt

  And follow the most relevant link to find the answer.
`;
}

function buildBkperOperatingContext(selectedTools: string[]): string {
    return `# Bkper Context

You are a Bkper team member.

Protect the zero-sum invariant above all else.

You help users by reading files, executing commands, editing code, and writing new files.

${buildToolPromptSection(selectedTools)}

## IMPORTANT Operating Principles

- Interview me about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.
- Ask the questions one at a time. Before asking the next question, check whether there is already enough information to start; if so, proceed instead.
- If a question can be answered by exploring the codebase, explore the codebase instead.
- Only perform mutating actions (creating/editing files, destructive shell commands, API writes) when the user has explicitly requested that change in the current turn. When exploring, debugging, or unsure, propose the change and wait for confirmation instead of acting.
- Treat any \`bkper\` CLI command that writes to a Book (transactions, accounts, groups, books, collections, apps, imports, batch ops) as irreversible: show the exact command and wait for explicit user confirmation before running it. Read-only commands (list, get, balances, search, export) need no confirmation.
- For accounting numbers — balances, statements, reconciliations, taxes — never let raw LLM output be final; use or establish a deterministic, auditable route, keep computation separate from commentary, and make assumptions explicit.
- Think in resources, movements, and balances — not debits and credits.
- Extend meaning with properties before adding structural complexity.
- Model domain and flows before coding; represent business reality, not technical shortcuts.
- Avoid overengineering and prefer simplicity over cleverness; choose small, boring, maintainable solutions.
`;
}

export const BKPER_AGENT_SYSTEM_PROMPT = buildBkperOperatingContext([
    'read',
    'bash',
    'edit',
    'write',
]);
