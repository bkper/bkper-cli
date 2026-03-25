import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CORE_CONCEPTS_CANONICAL_URL,
    renderCoreConceptsModule,
} from '../src/agent/core-concepts.js';

function resolveOutputPath(): string {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(scriptDir, '..', 'src', 'agent', 'generated', 'core-concepts.ts');
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

    const markdown = await response.text();
    if (!markdown.trim()) {
        throw new Error('Failed to fetch core concepts markdown: empty response body');
    }

    return markdown;
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
