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
