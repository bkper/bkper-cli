import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface DocSpec {
    url: string;
    filename: string;
    requiredHeadings: readonly string[];
}

const DOCS: readonly DocSpec[] = [
    {
        url: 'https://bkper.com/docs/core-concepts.md',
        filename: 'core-concepts.md',
        requiredHeadings: [
            '# Core Concepts',
            '## Accounts',
            '## Transactions',
            '## Books',
        ],
    },
    {
        url: 'https://bkper.com/docs/api/bkper-js.md',
        filename: 'bkper-js.md',
        requiredHeadings: [
            '# bkper-js',
            '## Classes',
            '### Book',
            '### Account',
            '### Transaction',
        ],
    },
    {
        url: 'https://bkper.com/docs/api/bkper-api-types.md',
        filename: 'bkper-api-types.md',
        requiredHeadings: [
            '# bkper-api-types',
            '## Interfaces',
            '### Account',
            '### Book',
            '### Transaction',
        ],
    },
];

function resolveOutputDir(): string {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(scriptDir, '..', 'docs');
}

function validateMarkdown(markdown: string, spec: DocSpec): void {
    if (!markdown.trim()) {
        throw new Error(`${spec.filename}: fetched markdown is empty.`);
    }

    for (const heading of spec.requiredHeadings) {
        if (!markdown.includes(heading)) {
            throw new Error(
                `${spec.filename}: missing required heading: ${heading}`
            );
        }
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
