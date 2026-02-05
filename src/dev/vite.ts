import { createServer, build as viteBuild, ViteDevServer, Plugin } from 'vite';
import path from 'path';
import { createAuthMiddleware } from './auth-middleware.js';

/**
 * Options for creating a Vite client dev server
 */
export interface ClientServerOptions {
    /** Port for the Vite dev server */
    port: number;
    /** Miniflare port for API proxy */
    serverPort: number;
}

/**
 * Options for building the client
 */
export interface ClientBuildOptions {
    /** Output directory (absolute path recommended) */
    outDir: string;
}

/**
 * Creates and starts a Vite dev server for the client.
 * Configures proxy to forward /api requests to Miniflare.
 * Adds middleware to handle /auth/refresh for local development auth.
 *
 * @param root - Path to Vite project root (client directory)
 * @param options - Server configuration options
 * @returns Running Vite dev server instance
 */
export async function createClientServer(
    root: string,
    options: ClientServerOptions
): Promise<ViteDevServer> {
    // Plugin to add auth middleware for local development
    const authPlugin: Plugin = {
        name: 'bkper-dev-auth',
        configureServer(server) {
            // Add middleware before other handlers
            server.middlewares.use(createAuthMiddleware());
        },
    };

    const server = await createServer({
        root,
        server: {
            port: options.port,
            host: '127.0.0.1', // Explicitly bind to IPv4 localhost
            strictPort: false, // Allow fallback to next available port
            proxy: {
                // Proxy API requests to Miniflare
                '/api': {
                    target: `http://localhost:${options.serverPort}`,
                    changeOrigin: true,
                },
            },
        },
        plugins: [authPlugin],
        // Disable config file to ensure CLI controls everything
        configFile: false,
        // Suppress Vite's own logging (we use our own logger)
        logLevel: 'warn',
    });

    await server.listen();
    return server;
}

/**
 * Builds the client for production.
 *
 * @param root - Path to Vite project root (client directory)
 * @param options - Build configuration options
 */
export async function buildClient(root: string, options: ClientBuildOptions): Promise<void> {
    await viteBuild({
        root,
        build: {
            // IMPORTANT: Use absolute path to ensure output goes to project root
            outDir: path.isAbsolute(options.outDir)
                ? options.outDir
                : path.resolve(process.cwd(), options.outDir),
            emptyOutDir: true,
        },
        // Disable config file
        configFile: false,
        // Silent logging for clean CLI output
        logLevel: 'silent',
    });
}

/**
 * Stops a Vite dev server.
 *
 * @param server - Vite dev server instance to stop
 */
export async function stopClientServer(server: ViteDevServer): Promise<void> {
    await server.close();
}

/**
 * Gets the resolved URL of a running Vite dev server.
 *
 * @param server - Running Vite dev server instance
 * @returns The server URL (e.g., "http://localhost:5173")
 */
export function getServerUrl(server: ViteDevServer): string | undefined {
    const info = server.resolvedUrls;
    return info?.local[0];
}
