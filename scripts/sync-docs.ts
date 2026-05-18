import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface DocSpec {
    url: string;
    filename: string;
}

const DOCS: readonly DocSpec[] = [
    {
        url: 'https://bkper.com/docs/core-concepts.md',
        filename: 'core-concepts.md',
    },
    {
        url: 'https://bkper.com/docs/api/bkper-js.md',
        filename: 'bkper-js.md',
    },
    {
        url: 'https://bkper.com/docs/api/bkper-api-types.md',
        filename: 'bkper-api-types.md',
    },
    {
        url: 'https://bkper.com/docs/build/apps/llms-full.txt',
        filename: 'app-building.md',
    },
];

function resolveOutputDir(): string {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(scriptDir, '..', 'docs');
}

export function validateMarkdown(markdown: string, spec: DocSpec): void {
    const trimmed = markdown.trim();
    if (!trimmed) {
        throw new Error(`${spec.filename}: fetched markdown is empty.`);
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) {
        throw new Error(
            `${spec.filename}: fetched content looks like HTML, not markdown.`
        );
    }
}

async function fetchMarkdown(spec: DocSpec): Promise<string> {
    const response = await fetch(spec.url, {
        headers: {
            'Accept': 'text/markdown,text/plain,*/*',
            'User-Agent': 'Mozilla/5.0 (compatible; bkper-cli sync)',
        },
    });

    if (!response.ok) {
        throw new Error(
            `${spec.filename}: fetch failed: ${response.status} ${response.statusText}`
        );
    }

    const markdown = await response.text();
    validateMarkdown(markdown, spec);
    return markdown;
}

async function syncDoc(spec: DocSpec, outputDir: string): Promise<void> {
    const markdown = await fetchMarkdown(spec);
    const outputPath = path.join(outputDir, spec.filename);
    await writeFile(outputPath, markdown, 'utf8');
    console.log(`✔ ${spec.filename}`);
}

async function main(): Promise<void> {
    const outputDir = resolveOutputDir();
    await mkdir(outputDir, { recursive: true });

    const results = await Promise.allSettled(
        DOCS.map(spec => syncDoc(spec, outputDir))
    );

    const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    if (failures.length > 0) {
        for (const f of failures) {
            console.error(`✘ ${f.reason}`);
        }
        process.exit(1);
    }
}

void main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
