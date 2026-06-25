import {
    copyFile,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(CLI_ROOT, 'docs');
const SYSTEM_PROMPT_PATH = path.join(
    CLI_ROOT,
    'src',
    'agent',
    'system-prompt.ts'
);
const SKILL_DIR = path.join(CLI_ROOT, 'skill');
const REFERENCES_DIR = path.join(SKILL_DIR, 'references');

const SKILL_NAME = 'bkper-cli';
const SKILL_DESCRIPTION =
    'Use Bkper CLI safely from external coding agents. Covers Bkper data management, app development, SDK references, financial reporting workflows, and guardrails for tool-using agents.';

async function readSystemPromptSource(): Promise<string> {
    return readFile(SYSTEM_PROMPT_PATH, 'utf8');
}

function extractBkperAgentSystemPrompt(source: string): string {
    const match = source.match(
        /export const BKPER_AGENT_SYSTEM_PROMPT = `([\s\S]*?)`;/
    );
    if (!match) {
        throw new Error(
            'Could not extract BKPER_AGENT_SYSTEM_PROMPT from system-prompt.ts'
        );
    }
    return match[1];
}

function stripToolSection(promptContent: string): string {
    return promptContent
        .replace(/\n+\$\{buildToolPromptSection\(\)\}\n+/, '\n\n')
        .trim();
}

function buildSkillPurposeSection(): string {
    return `## Skill Purpose

This skill is for external coding-agent harnesses — Claude Code, Codex, OpenCode, OpenClaw, Hermes Agent, and similar tools — when they can use local tools and shell commands.

Use it to help those agents operate the \`bkper\` CLI safely and understand the Bkper model while doing so.

For operational tasks against live Bkper data, recommend that the user install and authenticate the CLI first:

\`\`\`bash
npm i -g bkper
bkper auth login
\`\`\`

For general Bkper questions without local tool access, prefer published Bkper Markdown docs and \`llms.txt\` instead of relying on this skill alone.`;
}

function buildRequiredReadingSection(): string {
    return `## Required Reading

Bkper's accounting model is intentionally non-standard. Generic accounting knowledge — debit/credit, account categories, sign conventions — will lead you to wrong answers here.

Before reasoning about, designing, or modifying anything that touches Bkper data — books, accounts, groups, transactions, balances, queries, or any accounting or financial flow — you MUST read:

\`\`\`
references/core-concepts.md
\`\`\`

This is not optional and prior accounting intuition does not substitute for it.`;
}

function buildReferenceRoutingSection(): string {
    return `## Reference Routing

- Read local \`AGENTS.md\`, nearby files, and existing tests first for project-specific work.
- For any Bkper CLI or adjacent development task — CLI usage, SDK code, data management, or financial reports — read the docs index and then load the specific doc(s) it points to based on the task:

\`\`\`
references/index.md
\`\`\`

- ALWAYS read index docs and follow references to specific docs before running any bkper CLI command.
- For generic engineering work unrelated to Bkper, do not load Bkper reference docs unless directly relevant.
- When scope is unclear, inspect local files and project instructions first; load reference docs only after identifying a concrete need.
- If the task involves building or debugging pi extensions, custom tools, themes, or skills — read the pi docs directory and follow cross-references within the pi-coding-agent package documentation.
- For anything not covered by the local docs index, fetch and read:

  https://bkper.com/llms.txt

  And follow the most relevant link to find the answer.`;
}

function buildSkillMarkdown(coreContent: string): string {
    const frontmatter = `---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---`;

    const footer = `---

> **Note:** This skill is auto-generated from the Bkper CLI agent configuration for use in external coding-agent harnesses.`;

    return `${frontmatter}\n\n${coreContent}\n\n${buildSkillPurposeSection()}\n\n${buildRequiredReadingSection()}\n\n${buildReferenceRoutingSection()}\n\n${footer}\n`;
}

async function copyDocs(): Promise<string[]> {
    const files = await readdir(DOCS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const copied: string[] = [];

    for (const file of mdFiles) {
        await copyFile(path.join(DOCS_DIR, file), path.join(REFERENCES_DIR, file));
        copied.push(file);
    }

    return copied;
}

export async function generateSkill(): Promise<{
    copiedDocs: string[];
    removedSkills: string[];
}> {
    const source = await readSystemPromptSource();
    const promptContent = extractBkperAgentSystemPrompt(source);
    const coreContent = stripToolSection(promptContent);
    const skillMarkdown = buildSkillMarkdown(coreContent);

    // Clean and create directories
    await rm(SKILL_DIR, { recursive: true, force: true });
    await mkdir(REFERENCES_DIR, { recursive: true });

    // Write SKILL.md
    await writeFile(path.join(SKILL_DIR, 'SKILL.md'), skillMarkdown, 'utf8');

    // Copy docs
    const copiedDocs = await copyDocs();

    return { copiedDocs, removedSkills: [] };
}

async function main(): Promise<void> {
    const result = await generateSkill();
    console.log(`Generated skill at ${SKILL_DIR}`);
    console.log(`  SKILL.md`);
    for (const doc of result.copiedDocs) {
        console.log(`  references/${doc}`);
    }
    if (result.removedSkills.length > 0) {
        console.log(`Removed old skills: ${result.removedSkills.join(', ')}`);
    }
}

const isMain =
    import.meta.url.startsWith('file:') &&
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
    void main().catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exit(1);
    });
}
