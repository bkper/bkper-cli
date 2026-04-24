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
const SKILLS_REPO = path.resolve(CLI_ROOT, '..', 'skills');
const SKILLS_DIR = path.join(SKILLS_REPO, 'skills');
const SKILL_DIR = path.join(SKILLS_DIR, 'bkper-dev');
const REFERENCES_DIR = path.join(SKILL_DIR, 'references');

const SKILL_NAME = 'bkper-dev';
const SKILL_DESCRIPTION =
    'Comprehensive Bkper development skill covering CLI usage, SDK code (bkper-js), data management, financial reporting, app development, and support. Use for any Bkper-related task including books, accounts, transactions, groups, balances, queries, apps, automations, or integrations.';

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
- For any Bkper task — CLI usage, SDK code, data management, or financial reports — read the docs index and then load the specific doc(s) it points to based on the task:

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

> **Note:** This skill is auto-generated from the bkper-cli agent configuration. For the fully enforced interactive experience with conditional core-concepts preloading, use \`bkper agent\`.`;

    return `${frontmatter}\n\n${coreContent}\n\n${buildRequiredReadingSection()}\n\n${buildReferenceRoutingSection()}\n\n${footer}\n`;
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

async function removeOldSkills(): Promise<string[]> {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const removed: string[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        if (entry.name === 'bkper-dev') {
            continue;
        }
        if (!entry.name.startsWith('bkper-')) {
            continue;
        }
        const oldDir = path.join(SKILLS_DIR, entry.name);
        await rm(oldDir, { recursive: true, force: true });
        removed.push(entry.name);
    }

    return removed;
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

    // Remove old skills
    const removedSkills = await removeOldSkills();

    return { copiedDocs, removedSkills };
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
