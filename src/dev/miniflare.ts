import type { Miniflare, Log } from 'miniflare';
import { buildWorker } from './esbuild.js';

export interface WorkerServerOptions {
    port: number;
    kvNamespaces?: string[];
    vars?: Record<string, string>;
    compatibilityDate?: string;
    persist?: boolean;
    persistPath?: string;
}

/**
 * Internal interface for storing base configuration.
 * Used to support hot reload by preserving the original options.
 */
interface BaseConfig {
    port: number;
    compatibilityDate: string;
    compatibilityFlags: string[];
    log: Log;
    liveReload: boolean;
    kvNamespaces?: Record<string, string>;
    kvPersist?: string;
    bindings?: Record<string, string>;
}

/**
 * Store the base configuration for each Miniflare instance to support hot reload.
 * Maps Miniflare instance to its base configuration (without modules).
 */
const instanceConfigs = new WeakMap<Miniflare, BaseConfig>();

/**
 * Dynamically imports miniflare, exiting with a helpful message if not installed.
 */
async function loadMiniflare(): Promise<typeof import('miniflare')> {
    try {
        return await import('miniflare');
    } catch {
        console.error('miniflare is required for local development.');
        console.error('Install it as a devDependency (e.g. npm install -D miniflare).');
        process.exit(1);
    }
}

/**
 * Creates and starts a Miniflare instance for local Worker development
 *
 * @param entryPoint - Path to TypeScript Worker entry file
 * @param options - Server configuration options
 * @returns Configured and ready Miniflare instance
 */
export async function createWorkerServer(
    entryPoint: string,
    options: WorkerServerOptions
): Promise<Miniflare> {
    const { Miniflare: MiniflareClass, Log: LogClass, LogLevel } = await loadMiniflare();

    // Build the Worker code from TypeScript
    const script = await buildWorker(entryPoint);

    // Build the base configuration (without modules) for hot reload support
    const baseConfig: BaseConfig = {
        // Server port
        port: options.port,

        // Compatibility settings (match production)
        compatibilityDate: options.compatibilityDate || '2026-01-29',
        compatibilityFlags: ['nodejs_compat'],

        // Logging
        log: new LogClass(LogLevel.INFO),

        // Live reload (inject script into HTML responses)
        liveReload: true,

        // KV namespaces - convert array to object format
        // ["KV"] -> { KV: "kv-local" }
        kvNamespaces: options.kvNamespaces?.reduce(
            (acc, ns) => ({ ...acc, [ns]: `${ns.toLowerCase()}-local` }),
            {} as Record<string, string>
        ),

        // Persist KV data across restarts
        kvPersist: options.persist !== false ? options.persistPath ?? './.mf/kv' : undefined,

        // Environment variables and secrets
        bindings: options.vars,
    };

    const mf = new MiniflareClass({
        ...baseConfig,
        // Use modules array format instead of script string
        // This allows Miniflare to properly handle dynamic imports of external modules
        // like cloudflare:workers that are used by libraries (e.g., Hono)
        modules: [
            {
                type: 'ESModule',
                path: 'index.js', // Virtual path for the bundled module
                contents: script,
            },
        ],
    });

    // Store the base config for hot reload
    instanceConfigs.set(mf, baseConfig);

    // Wait for Miniflare to be ready
    await mf.ready;
    return mf;
}

/**
 * Reloads a Worker with new code (hot reload).
 * Rebuilds the entry point and updates Miniflare.
 *
 * @param mf - Existing Miniflare instance
 * @param entryPoint - Path to TypeScript Worker entry file
 */
export async function reloadWorker(mf: Miniflare, entryPoint: string): Promise<void> {
    const script = await buildWorker(entryPoint);
    await updateWorkerCode(mf, script);
}

/**
 * Updates a Worker with pre-built code (used by esbuild watch mode).
 * Skips the build step — expects code that's already bundled.
 *
 * @param mf - Existing Miniflare instance
 * @param code - Pre-built JavaScript code string
 */
export async function updateWorkerCode(mf: Miniflare, code: string): Promise<void> {
    // Retrieve the stored base config
    const baseConfig = instanceConfigs.get(mf);
    if (!baseConfig) {
        // Fallback: use minimal config if no stored config (shouldn't happen normally)
        await mf.setOptions({
            modules: [
                {
                    type: 'ESModule',
                    path: 'index.js',
                    contents: code,
                },
            ],
        });
        return;
    }

    // Apply the full config with new modules
    await mf.setOptions({
        ...baseConfig,
        modules: [
            {
                type: 'ESModule',
                path: 'index.js',
                contents: code,
            },
        ],
    });
}

/**
 * Gracefully stops a Miniflare instance
 *
 * @param mf - Miniflare instance to stop
 */
export async function stopWorkerServer(mf: Miniflare): Promise<void> {
    await mf.dispose();
}
