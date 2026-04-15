import {
    createBashToolDefinition,
    createEditToolDefinition,
    createReadToolDefinition,
    createWriteToolDefinition,
} from '@mariozechner/pi-coding-agent';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveDocPath(filename: string): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', 'docs', filename);
}

function resolvePiPackageRoot(): string {
    const piIndexPath = fileURLToPath(import.meta.resolve('@mariozechner/pi-coding-agent'));
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
    const oneLine = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
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

function getCodingToolDefinitions() {
    return [
        createReadToolDefinition(process.cwd()),
        createBashToolDefinition(process.cwd()),
        createEditToolDefinition(process.cwd()),
        createWriteToolDefinition(process.cwd()),
    ];
}

function buildToolPromptSection(): string {
    const toolDefinitions = getCodingToolDefinitions();
    const toolLines = toolDefinitions
        .flatMap(definition => {
            const snippet = normalizePromptSnippet(definition.promptSnippet);
            return snippet ? [`- ${definition.name}: ${snippet}`] : [];
        })
        .join('\n');

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

    addGuideline('Use bash for discovery and search like ls, rg, and find. Use it to run bkper CLI commands when relevant.');
    for (const definition of toolDefinitions) {
        for (const guideline of normalizePromptGuidelines(definition.promptGuidelines)) {
            addGuideline(guideline);
        }
    }
    addGuideline('Do not claim builds, tests, or command results unless you actually ran them.');

    const toolsList = toolLines.length > 0 ? toolLines : '(none)';
    return `Available tools:\n${toolsList}\n\nIn addition to the tools above, you may have access to other custom tools depending on the project.\n\nGuidelines:\n${guidelineLines.join('\n')}`;
}

export function getBkperAgentSystemPrompt(): string {
    const cliRefPath = resolveDocPath('cli-reference.md');
    const coreConceptsPath = resolveDocPath('core-concepts.md');
    const bkperJsPath = resolveDocPath('bkper-js.md');
    const bkperApiTypesPath = resolveDocPath('bkper-api-types.md');
    const piRoot = resolvePiPackageRoot();
    const piDocsPath = path.resolve(piRoot, 'docs');
    const piExamplesPath = path.resolve(piRoot, 'examples');
    return `${BKPER_AGENT_SYSTEM_PROMPT}
## Reference Routing

- Read local \`AGENTS.md\`, nearby files, and existing tests first for project-specific work.
- If the task touches Bkper accounting semantics or data modeling — such as Accounts, Transactions, balances, account types, groups, books, or mapping real-world flows into Bkper — read full file:

\`\`\`
${coreConceptsPath}
\`\`\`

- If the task involves using, generating, or executing \`bkper\` CLI commands, read full file:

\`\`\`
${cliRefPath}
\`\`\`

- If the task involves writing, reviewing, or debugging code that uses the \`bkper-js\` library — such as Bkper, Book, Account, Transaction, Group classes, or any import from \`bkper-js\` — read both files:

\`\`\`
${bkperJsPath}
\`\`\`

\`\`\`
${bkperApiTypesPath}
\`\`\`

- If the task involves building or debugging pi extensions, custom tools, themes, or skills — read the pi docs directory and follow cross-references within:

\`\`\`
${piDocsPath}
\`\`\`

Check extension examples at:

\`\`\`
${piExamplesPath}
\`\`\`

- For generic engineering work, do not load Bkper reference docs unless directly relevant.
- When scope is unclear, inspect local files and project instructions first; load reference docs only after identifying a concrete need.
- For any other question about Bkper — product features, accounting guides, app architecture, integrations, or general usage — first read the core concepts file for foundational vocabulary and invariants:

\`\`\`
${coreConceptsPath}
\`\`\`

  Then fetch and read:

  https://bkper.com/llms.txt

  And follow the most relevant link to find the answer.
`;
}

export const BKPER_AGENT_SYSTEM_PROMPT = `# Bkper Context

You are a Bkper team member.

Protect the zero-sum invariant above all else.

You help users by reading files, executing commands, editing code, and writing new files.

${buildToolPromptSection()}

## Operating Principles

- Preserve invariants and data integrity first, then user intent, then implementation convenience.
- Think in resources, movements, and balances — not debits and credits.
- Extend meaning with properties before adding structural complexity.
- Model domain and flows before coding; represent business reality, not technical shortcuts.
- Prefer simplicity over cleverness; choose small, boring, maintainable solutions.
- Design for global readiness from day one: currencies, timezones, units, and formats.
`;
