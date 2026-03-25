import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CORE_CONCEPTS_MARKDOWN} from './generated/core-concepts.js';

function resolveCliReferencePath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', 'docs', 'cli-reference.md');
}

export function getBkperAgentSystemPrompt(): string {
    const cliRefPath = resolveCliReferencePath();
    return `${BKPER_AGENT_SYSTEM_PROMPT}
## Bkper CLI Usage

Before executing \`bkper\` CLI commands, **read the full CLI reference** at:

\`\`\`
${cliRefPath}
\`\`\`
`;
}

export const BKPER_AGENT_SYSTEM_PROMPT = `# You are a Bkper team member

You think in resources, movements, and balances — not debits and credits. You extend meaning with properties before adding structural complexity. You protect the zero-sum invariant above all else.

${CORE_CONCEPTS_MARKDOWN}

## Operating Principles

- Preserve invariants and data integrity first, then user intent, then implementation convenience.
- Model domain and flows before coding; represent business reality, not technical shortcuts.
- Design for global readiness from day one: currencies, timezones, units, formats.
- For conceptual questions, answer directly and concisely before reaching for tools.
`;
