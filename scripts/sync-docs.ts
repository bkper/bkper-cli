import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface DocSpec {
    url: string;
    outputPath: string;
}

interface FetchedDoc {
    spec: DocSpec;
    markdown: string;
}

const BKPER_DOCS_ORIGIN = 'https://bkper.com';
const APP_DOCS_SOURCE_PREFIX = '/docs/platform/apps/';
const APP_DOCS_INDEX_SPEC: DocSpec = {
    url: `${BKPER_DOCS_ORIGIN}${APP_DOCS_SOURCE_PREFIX}llms.txt`,
    outputPath: 'apps/llms.txt',
};

const DOCS: readonly DocSpec[] = [
    {
        url: 'https://bkper.com/docs/core-concepts.md',
        outputPath: 'core/core-concepts.md',
    },
    {
        url: 'https://bkper.com/docs/api/bkper-js.md',
        outputPath: 'sdk/bkper-js.md',
    },
    {
        url: 'https://bkper.com/docs/api/bkper-api-types.md',
        outputPath: 'sdk/bkper-api-types.md',
    },
];

export function discoverAppDocSpecs(index: string): readonly DocSpec[] {
    const specs: DocSpec[] = [];
    const outputPaths = new Set<string>();
    const linkPattern =
        /^- \[[^\]]+\]\(https:\/\/bkper\.com\/docs\/platform\/apps\/([a-z0-9][a-z0-9-]*\.md)\)(?::.*)?$/;

    for (const line of index.split(/\r?\n/)) {
        const match = linkPattern.exec(line.trim());
        if (!match) {
            continue;
        }

        const filename = match[1];
        const outputPath = `apps/${filename}`;
        if (outputPaths.has(outputPath)) {
            throw new Error(
                `App docs index contains duplicate link: ${outputPath}.`
            );
        }
        outputPaths.add(outputPath);
        specs.push({
            url: `${BKPER_DOCS_ORIGIN}${APP_DOCS_SOURCE_PREFIX}${filename}`,
            outputPath,
        });
    }

    if (specs.length === 0) {
        throw new Error('App docs index contains no canonical document links.');
    }

    return specs;
}

export function findStaleAppDocNames(
    localNames: readonly string[],
    appDocSpecs: readonly DocSpec[]
): readonly string[] {
    const activeNames = new Set(
        appDocSpecs.map(spec => path.posix.basename(spec.outputPath))
    );
    return localNames
        .filter(name => name.endsWith('.md') && !activeNames.has(name))
        .sort();
}

function resolveOutputDir(): string {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(scriptDir, '..', 'skill', 'references');
}

export function validateMarkdown(markdown: string, spec: DocSpec): void {
    const trimmed = markdown.trim();
    if (!trimmed) {
        throw new Error(`${spec.outputPath}: fetched markdown is empty.`);
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) {
        throw new Error(
            `${spec.outputPath}: fetched content looks like HTML, not markdown.`
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
            `${spec.outputPath}: fetch failed: ${response.status} ${response.statusText}`
        );
    }

    const markdown = await response.text();
    validateMarkdown(markdown, spec);
    return markdown;
}

async function fetchDoc(spec: DocSpec): Promise<FetchedDoc> {
    return {
        spec,
        markdown: await fetchMarkdown(spec),
    };
}

async function writeDoc(doc: FetchedDoc, outputDir: string): Promise<void> {
    const outputPath = path.join(outputDir, doc.spec.outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, doc.markdown, 'utf8');
    console.log(`✔ ${doc.spec.outputPath}`);
}

async function removeStaleAppDocs(
    outputDir: string,
    appDocSpecs: readonly DocSpec[]
): Promise<void> {
    const appDocsDir = path.join(outputDir, 'apps');
    const entries = await readdir(appDocsDir, { withFileTypes: true });
    const localNames = entries.filter(entry => entry.isFile()).map(entry => entry.name);
    const staleNames = findStaleAppDocNames(localNames, appDocSpecs);

    await Promise.all(
        staleNames.map(async name => {
            await unlink(path.join(appDocsDir, name));
            console.log(`✔ removed apps/${name}`);
        })
    );
}

async function main(): Promise<void> {
    const index = await fetchMarkdown(APP_DOCS_INDEX_SPEC);
    const appDocSpecs = discoverAppDocSpecs(index);
    const fetchedDocs = await Promise.all([...DOCS, ...appDocSpecs].map(fetchDoc));

    const outputDir = resolveOutputDir();
    await mkdir(outputDir, { recursive: true });
    await Promise.all(fetchedDocs.map(doc => writeDoc(doc, outputDir)));
    await removeStaleAppDocs(outputDir, appDocSpecs);
}

function isDirectInvocation(): boolean {
    const entrypoint = process.argv[1];
    return entrypoint
        ? import.meta.url === pathToFileURL(path.resolve(entrypoint)).href
        : false;
}

if (isDirectInvocation()) {
    void main().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
