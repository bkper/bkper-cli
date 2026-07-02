import type { Miniflare, Log } from 'miniflare';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { buildWorker } from './esbuild.js';
import type { LocalAssetsService } from './local-assets.js';
import type { LocalOutboundService } from './local-outbound.js';

export interface WorkerServerOptions {
    port: number;
    kvNamespaces?: string[];
    vars?: Record<string, string>;
    compatibilityDate?: string;
    persist?: boolean;
    persistPath?: string;
    assetsService?: LocalAssetsService;
    outboundService?: LocalOutboundService;
    clientOrigin?: string;
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
    serviceBindings?: Record<string, LocalAssetsService>;
    outboundService?: LocalOutboundService;
    clientOrigin?: string;
}

/**
 * Store the base configuration for each Miniflare instance to support hot reload.
 * Maps Miniflare instance to its base configuration (without modules).
 */
const instanceConfigs = new WeakMap<Miniflare, BaseConfig>();
const require = createRequire(import.meta.url);

interface WorkerModule {
    type: 'ESModule';
    path: string;
    contents: string;
}

const APP_WORKER_MODULE_PATH = 'app-worker.js';
const LOCAL_DISPATCH_WRAPPER_PATH = 'index.js';

function createLocalDispatchWrapper(clientOrigin: string | undefined): string {
    const serializedClientOrigin = JSON.stringify(clientOrigin ?? '');

    return `
import appWorker from './${APP_WORKER_MODULE_PATH}';

const CLIENT_ORIGIN = ${serializedClientOrigin};
const PLATFORM_SESSION_COOKIE_NAMES = new Set([
    'bkper_session',
    'bkper_session_dev',
    'bkper_session_local',
]);

const RESERVED_PLATFORM_REQUEST_HEADERS = [
    'Authorization',
    'bkper-oauth-token',
    'bkper-agent-id',
];

const WORKER_BROWSER_ENDPOINTS = new Set([
    '/health',
    '/openapi.json',
]);

function shouldRedirectToClient(request) {
    if (!CLIENT_ORIGIN || (request.method !== 'GET' && request.method !== 'HEAD')) {
        return false;
    }

    const url = new URL(request.url);
    if (isWorkerEndpoint(url.pathname)) {
        return false;
    }

    const accept = request.headers.get('Accept') || '';
    const fetchMode = request.headers.get('Sec-Fetch-Mode') || '';
    return fetchMode === 'navigate' || accept.includes('text/html') || accept === '';
}

function isWorkerEndpoint(pathname) {
    return (
        WORKER_BROWSER_ENDPOINTS.has(pathname) ||
        pathname === '/events' ||
        pathname.startsWith('/events/') ||
        pathname === '/api' ||
        pathname.startsWith('/api/')
    );
}

function buildClientRedirectUrl(request) {
    const targetUrl = new URL(request.url);
    const clientUrl = new URL(CLIENT_ORIGIN);
    targetUrl.protocol = clientUrl.protocol;
    targetUrl.host = clientUrl.host;
    return targetUrl.toString();
}

function stripPlatformRequestCredentials(request) {
    const headers = new Headers(request.headers);
    stripPlatformCookieHeader(headers);
    for (const header of RESERVED_PLATFORM_REQUEST_HEADERS) {
        headers.delete(header);
    }

    return new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        redirect: request.redirect,
        signal: request.signal,
    });
}

function stripPlatformCookieHeader(headers) {
    const cookie = headers.get('Cookie');
    if (!cookie) {
        return;
    }

    const filtered = cookie
        .split(';')
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .filter(part => !isPlatformCookiePair(part))
        .join('; ');

    if (filtered) {
        headers.set('Cookie', filtered);
    } else {
        headers.delete('Cookie');
    }
}

function isPlatformCookiePair(cookiePair) {
    const cookieName = cookiePair.split('=', 1)[0]?.trim().toLowerCase();
    return PLATFORM_SESSION_COOKIE_NAMES.has(cookieName);
}

export default {
    fetch(request, env, ctx) {
        if (shouldRedirectToClient(request)) {
            return Response.redirect(buildClientRedirectUrl(request), 302);
        }

        return appWorker.fetch(stripPlatformRequestCredentials(request), env, ctx);
    },
};
`;
}

function buildWorkerModules(script: string, clientOrigin?: string): WorkerModule[] {
    return [
        {
            type: 'ESModule',
            path: LOCAL_DISPATCH_WRAPPER_PATH,
            contents: createLocalDispatchWrapper(clientOrigin),
        },
        {
            type: 'ESModule',
            path: APP_WORKER_MODULE_PATH,
            contents: script,
        },
    ];
}

/**
 * Resolves the Miniflare entry point from the app project root.
 * This allows a globally installed bkper CLI to load the app-local devDependency.
 */
export function resolveMiniflareModulePath(projectRoot: string): string {
    return require.resolve('miniflare', { paths: [projectRoot] });
}

/**
 * Dynamically imports Miniflare from the app project root, exiting with a helpful
 * message if it is not installed there.
 */
async function loadMiniflare(projectRoot: string = process.cwd()): Promise<typeof import('miniflare')> {
    let resolvedPath: string;
    try {
        resolvedPath = resolveMiniflareModulePath(projectRoot);
    } catch {
        console.error('miniflare is required for local development.');
        console.error(
            'Install it in the app root devDependencies (e.g. bun add -d miniflare or npm install -D miniflare).'
        );
        process.exit(1);
    }

    return (await import(pathToFileURL(resolvedPath).href)) as typeof import('miniflare');
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

        // Local ASSETS service proxies static asset requests to Vite.
        serviceBindings: options.assetsService ? { ASSETS: options.assetsService } : undefined,

        // Local outbound service emulates Workers for Platforms egress policies.
        outboundService: options.outboundService,

        // Client browser origin used to redirect accidental Worker-root navigations.
        clientOrigin: options.clientOrigin,
    };

    const { clientOrigin, ...miniflareBaseConfig } = baseConfig;
    const mf = new MiniflareClass({
        ...miniflareBaseConfig,
        // Use modules array format instead of script string
        // This allows Miniflare to properly handle dynamic imports of external modules
        // like cloudflare:workers that are used by libraries (e.g., Hono)
        modules: buildWorkerModules(script, clientOrigin),
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
            modules: buildWorkerModules(code),
        });
        return;
    }

    const { clientOrigin, ...miniflareBaseConfig } = baseConfig;

    // Apply the full config with new modules
    await mf.setOptions({
        ...miniflareBaseConfig,
        modules: buildWorkerModules(code, clientOrigin),
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
