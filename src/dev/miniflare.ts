import { Miniflare, Log, LogLevel } from 'miniflare';
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
        log: new Log(LogLevel.INFO),

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

    const mf = new Miniflare({
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
 * Reloads a Worker with new code (hot reload)
 * Rebuilds the entry point and updates Miniflare
 *
 * @param mf - Existing Miniflare instance
 * @param entryPoint - Path to TypeScript Worker entry file
 */
export async function reloadWorker(mf: Miniflare, entryPoint: string): Promise<void> {
    const script = await buildWorker(entryPoint);

    // Retrieve the stored base config
    const baseConfig = instanceConfigs.get(mf);
    if (!baseConfig) {
        // Fallback: use minimal config if no stored config (shouldn't happen normally)
        await mf.setOptions({
            modules: [
                {
                    type: 'ESModule',
                    path: 'index.js',
                    contents: script,
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
                contents: script,
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
