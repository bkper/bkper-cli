import { build, type BuildOptions, type Metafile, type Plugin } from 'esbuild';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Bundles `bkper agent` so it loads a handful of files instead of ~1,600 small ones from Pi and its
 * dependencies. Pi's own CLI ships the same way (see its scripts/build-coding-agent-bundle.mjs);
 * this follows that script, adapted to bundle Pi from node_modules together with our agent.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'lib', 'agent', 'bundle');

/**
 * Packages the bundle loads at runtime from bkper's node_modules rather than inlining: jiti and
 * photon-node are kept external, and Pi resolves quickjs-wasi's wasm file next to its code.
 * package.json pins them to Pi's versions so they are always installed where the bundle looks.
 */
export const PACKAGES_RESOLVED_FROM_BKPER = [
    '@silvia-odwyer/photon-node',
    'jiti',
    'quickjs-wasi',
] as const;

const EXTERNAL_PACKAGES = [
    '@silvia-odwyer/photon-node',
    'jiti',
    // Optional native accelerators and helpers; their callers fall back when they are absent.
    'bufferutil',
    'utf-8-validate',
    'kerberos',
    'supports-color',
];

const BANNER = {
    js: 'import { createRequire as __bkperCreateRequire } from "node:module"; const require = __bkperCreateRequire(import.meta.url);',
};

/**
 * gaxios loads https-proxy-agent with a dynamic import and reads its named export, which an
 * esbuild-bundled CommonJS module does not provide. Re-export it from an ES module wrapper.
 */
const httpsProxyAgentNamedExportPlugin: Plugin = {
    name: 'https-proxy-agent-named-export',
    setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^https-proxy-agent$/ }, args =>
            args.kind === 'dynamic-import'
                ? {
                      namespace: 'https-proxy-agent-named-export',
                      path: args.path,
                      pluginData: args.resolveDir,
                  }
                : undefined
        );
        pluginBuild.onLoad(
            { filter: /.*/, namespace: 'https-proxy-agent-named-export' },
            args => ({
                contents: 'export { HttpsProxyAgent } from "https-proxy-agent";',
                loader: 'js',
                resolveDir: String(args.pluginData),
            })
        );
    },
};

function commonOptions(): BuildOptions {
    return {
        absWorkingDir: REPO_ROOT,
        banner: BANNER,
        bundle: true,
        // Pi then gives extensions its bundled modules, the same copies the agent uses.
        define: { PI_BUNDLED_NODE: 'true' },
        external: EXTERNAL_PACKAGES,
        format: 'esm',
        legalComments: 'none',
        logLevel: 'warning',
        minifySyntax: true,
        minifyWhitespace: true,
        platform: 'node',
        plugins: [httpsProxyAgentNamedExportPlugin],
        target: 'node22.19',
    };
}

/** Builds with the shared options and returns the metafile the validations read. */
async function bundle(options: BuildOptions): Promise<Metafile> {
    const result = await build({ ...commonOptions(), ...options, metafile: true });
    return result.metafile;
}

function packageDistDir(packageName: string): string {
    // Each package entry is dist/index.js.
    return path.dirname(fileURLToPath(import.meta.resolve(packageName)));
}

/** Modules Pi imports through a variable specifier relative to its own code, `./<name>.ts`. */
function findLazyModules(loaderFile: string, helperName: string): string[] {
    const source = readFileSync(loaderFile, 'utf8');
    const pattern = new RegExp(`${helperName}\\("\\./([\\w-]+)\\.ts"\\)`, 'g');
    const names = [...source.matchAll(pattern)].map(match => match[1]);
    if (names.length === 0) {
        throw new Error(
            `No ${helperName}() modules found in ${loaderFile}. Pi changed how it loads them; update this script.`
        );
    }
    return names.map(name => path.join(path.dirname(loaderFile), `${name}.js`));
}

/**
 * These are loaded relative to the code that imports them, which is the bundle, so each is emitted
 * as its own file beside it. Missing one breaks a provider login or image handling at runtime.
 */
function getLazyEntryPoints(): Record<string, string> {
    const piAiDist = packageDistDir('@earendil-works/pi-ai');
    const codingAgentDist = packageDistDir('@earendil-works/pi-coding-agent');
    const lazyApiLoaders = readdirSync(path.join(piAiDist, 'api'))
        .filter(file => file.endsWith('.lazy.js'))
        .map(file => path.join(piAiDist, 'api', file))
        .filter(file => readFileSync(file, 'utf8').includes('importNodeOnlyApi("'));

    const files = [
        ...findLazyModules(path.join(piAiDist, 'auth', 'oauth', 'load.js'), 'importOAuthModule'),
        ...lazyApiLoaders.flatMap(file => findLazyModules(file, 'importNodeOnlyApi')),
        path.join(codingAgentDist, 'utils', 'image-resize-worker.js'),
    ];
    return Object.fromEntries(files.map(file => [path.basename(file, '.js'), file]));
}

function isAllowedExternal(importPath: string): boolean {
    return (
        isBuiltin(importPath) ||
        EXTERNAL_PACKAGES.some(name => importPath === name || importPath.startsWith(`${name}/`))
    );
}

function validateExternals(metafiles: Metafile[]): void {
    const unexpected = new Set<string>();
    for (const metafile of metafiles) {
        for (const input of Object.values(metafile.inputs)) {
            for (const imported of input.imports) {
                if (imported.external && !isAllowedExternal(imported.path)) {
                    unexpected.add(imported.path);
                }
            }
        }
    }
    if (unexpected.size > 0) {
        throw new Error(`Bundle left unexpected external imports: ${[...unexpected].sort().join(', ')}`);
    }
}

/** Two copies of a Pi package would split module state such as keybindings between them. */
function validateSinglePiCopies(metafile: Metafile): void {
    const copies = new Map<string, Set<string>>();
    for (const input of Object.keys(metafile.inputs)) {
        const match = /^(.*node_modules\/(@earendil-works\/[^/]+))\//.exec(input);
        if (!match) continue;
        const [, root, name] = match;
        copies.set(name, (copies.get(name) ?? new Set()).add(root));
    }
    for (const [name, roots] of copies) {
        if (roots.size > 1) {
            throw new Error(`Bundle includes ${roots.size} copies of ${name}: ${[...roots].join(', ')}`);
        }
    }
}

/**
 * Pi spawns the codemode worker from a data: URL, so it must not use the createRequire banner,
 * relative imports, or import.meta.
 */
function validateCodemodeWorker(metafile: Metafile, outDir: string): void {
    for (const output of Object.values(metafile.outputs)) {
        const invalid = output.imports.filter(
            imported => imported.kind !== 'import-statement' || !isBuiltin(imported.path)
        );
        if (invalid.length > 0) {
            throw new Error(
                `Codemode worker must only import Node builtins: ${invalid.map(i => i.path).join(', ')}`
            );
        }
    }
    if (readFileSync(path.join(outDir, 'codemode-worker.js'), 'utf8').includes('import.meta')) {
        throw new Error('Codemode worker must not use import.meta');
    }
}

export interface AgentBundleResult {
    /** File names written to the output directory. */
    files: string[];
}

export async function buildAgentBundle({
    outDir = DEFAULT_OUT_DIR,
}: { outDir?: string } = {}): Promise<AgentBundleResult> {
    rmSync(outDir, { force: true, recursive: true });
    mkdirSync(outDir, { recursive: true });

    const main = await bundle({
        entryPoints: {
            'agent-entry': path.join(REPO_ROOT, 'src', 'agent', 'agent-entry.ts'),
            // Spawned by the update check from beside its caller, which is now the bundle.
            'update-worker': path.join(REPO_ROOT, 'src', 'upgrade', 'update-worker.ts'),
        },
        outdir: outDir,
    });

    const lazy = await bundle({
        entryPoints: getLazyEntryPoints(),
        outdir: outDir,
    });

    const codemodeWorker = await bundle({
        banner: undefined,
        entryPoints: {
            'codemode-worker': path.join(
                packageDistDir('@earendil-works/pi-coding-agent'),
                'extensions',
                'codemode',
                'worker.js'
            ),
        },
        outdir: outDir,
    });

    validateExternals([main, lazy, codemodeWorker]);
    validateSinglePiCopies(main);
    validateCodemodeWorker(codemodeWorker, outDir);

    return { files: readdirSync(outDir).sort() };
}

function isDirectInvocation(): boolean {
    const entrypoint = process.argv[1];
    return entrypoint
        ? import.meta.url === pathToFileURL(path.resolve(entrypoint)).href
        : false;
}

if (isDirectInvocation()) {
    buildAgentBundle()
        .then(({ files }) => {
            console.log(`Built ${path.relative(REPO_ROOT, DEFAULT_OUT_DIR)} (${files.length} files)`);
        })
        .catch(error => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(message);
            process.exit(1);
        });
}
