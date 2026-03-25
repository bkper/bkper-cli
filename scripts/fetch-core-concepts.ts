import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_CONCEPTS_CANONICAL_URL = 'https://bkper.com/docs/core-concepts.md';
const REQUIRED_CORE_CONCEPTS_HEADINGS = [
    '# Core Concepts',
    '## Accounts',
    '## Transactions',
    '## Books',
] as const;

function resolveOutputPath(): string {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(scriptDir, '..', 'src', 'agent', 'core-concepts.ts');
}

function validateCoreConceptsMarkdown(markdown: string): void {
    if (!markdown.trim()) {
        throw new Error('Core concepts markdown is empty.');
    }

    for (const heading of REQUIRED_CORE_CONCEPTS_HEADINGS) {
        if (!markdown.includes(heading)) {
            throw new Error(`Core concepts markdown is missing required heading: ${heading}`);
        }
    }
}

function escapeForTemplateLiteral(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
}

function renderCoreConceptsModule(markdown: string): string {
    validateCoreConceptsMarkdown(markdown);

    const escapedMarkdown = escapeForTemplateLiteral(markdown);
    return `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Source: ${CORE_CONCEPTS_CANONICAL_URL}\n\nexport const CORE_CONCEPTS_MARKDOWN = \`${escapedMarkdown}\`;\n`;
}

async function fetchCoreConceptsMarkdown(): Promise<string> {
    const response = await fetch(CORE_CONCEPTS_CANONICAL_URL, {
        headers: {
            'Accept': 'text/markdown,text/plain,*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; bkper-cli build)',
        },
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch core concepts markdown: ${response.status} ${response.statusText}`
        );
    }

    return response.text();
}

async function main(): Promise<void> {
    const markdown = await fetchCoreConceptsMarkdown();
    const outputPath = resolveOutputPath();
    const moduleSource = renderCoreConceptsModule(markdown);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, moduleSource, 'utf8');
}

void main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
