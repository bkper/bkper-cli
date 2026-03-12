import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

/**
 * Plugin to externalize cloudflare:* and node:* imports.
 * These are provided by the Workers runtime and should not be bundled.
 */
export const workersExternalsPlugin: esbuild.Plugin = {
    name: 'workers-externals',
    setup(build) {
        // Cloudflare-specific imports (Durable Objects, Sockets, etc.)
        build.onResolve({ filter: /^cloudflare:.*/ }, () => ({ external: true }));

        // Node.js built-in modules (when using nodejs_compat)
        build.onResolve({ filter: /^node:.*/ }, () => ({ external: true }));
    },
};

/**
 * Shared esbuild configuration for Cloudflare Workers.
 *
 * Configuration rationale:
 * - target: es2024 - Workers runtime uses V8 with ES2024 support (not esnext)
 * - format: esm - Modern Workers require ES Modules
 * - conditions: ['workerd', 'worker', 'browser'] - Critical for package resolution
 */
function getBaseConfig(entryPoint: string): esbuild.BuildOptions {
    return {
        entryPoints: [entryPoint],
        bundle: true,
        format: 'esm',
        target: 'es2024',
        conditions: ['workerd', 'worker', 'browser'],
        plugins: [workersExternalsPlugin],
        minify: process.env.NODE_ENV === 'production',
    };
}

/**
 * Builds a Worker and returns the bundled code as a string.
 * Used for Miniflare integration (in-memory).
 *
 * Configuration rationale:
 * - target: es2024 - Workers runtime uses V8 with ES2024 support (not esnext)
 * - format: esm - Modern Workers require ES Modules
 * - conditions: ['workerd', 'worker', 'browser'] - Critical for package resolution
 *
 * @param entryPoint - Path to TypeScript entry file
 * @returns The bundled JavaScript code as a string
 */
export async function buildWorker(entryPoint: string): Promise<string> {
    const result = await esbuild.build({
        ...getBaseConfig(entryPoint),
        write: false,
        sourcemap: 'inline',
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
        throw new Error('Build produced no output files');
    }

    return result.outputFiles[0].text;
}

/**
 * Builds a Worker and writes to a file.
 * Used for deployment builds.
 *
 * @param entryPoint - Path to TypeScript entry file
 * @param outfile - Path to output JavaScript file
 */
export async function buildWorkerToFile(entryPoint: string, outfile: string): Promise<void> {
    // Ensure parent directory exists
    const outDir = path.dirname(outfile);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    await esbuild.build({
        ...getBaseConfig(entryPoint),
        outfile,
        write: true,
        sourcemap: true,
    });
}

/**
 * Handle returned by watchWorker for cleanup.
 */
export interface WatchHandle {
    dispose: () => Promise<void>;
}

/**
 * Watches a Worker entry point using esbuild's incremental build context.
 * Replaces chokidar for server and events file watching — esbuild tracks
 * the full dependency graph automatically, so any imported file change
 * triggers a rebuild.
 *
 * The `onRebuild` callback receives the bundled code string on each
 * successful rebuild. Feed this directly to `updateWorkerCode()`.
 *
 * @param entryPoint - Path to TypeScript Worker entry file
 * @param onRebuild - Callback invoked with bundled code after each successful rebuild
 * @returns Handle with dispose() to stop watching
 */
export async function watchWorker(
    entryPoint: string,
    onRebuild: (code: string) => void
): Promise<WatchHandle> {
    const ctx = await esbuild.context({
        ...getBaseConfig(entryPoint),
        write: false,
        sourcemap: 'inline',
        plugins: [
            workersExternalsPlugin,
            {
                name: 'notify-rebuild',
                setup(build) {
                    build.onEnd(result => {
                        if (result.errors.length === 0 && result.outputFiles?.[0]) {
                            onRebuild(result.outputFiles[0].text);
                        }
                    });
                },
            },
        ],
    });
    await ctx.watch();
    return { dispose: () => ctx.dispose() };
}
