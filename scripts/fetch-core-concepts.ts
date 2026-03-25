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
    return path.resolve(scriptDir, '..', 'docs', 'core-concepts.md');
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

async function fetchCoreConceptsMarkdown(): Promise<string> {
    const response = await fetch(CORE_CONCEPTS_CANONICAL_URL, {
        headers: {
            'Accept': 'text/markdown,text/plain,*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; bkper-cli sync)',
        },
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch core concepts markdown: ${response.status} ${response.statusText}`
        );
    }

    const markdown = await response.text();
    validateCoreConceptsMarkdown(markdown);
    return markdown;
}

async function main(): Promise<void> {
    const markdown = await fetchCoreConceptsMarkdown();
    const outputPath = resolveOutputPath();

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, 'utf8');
}

void main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
