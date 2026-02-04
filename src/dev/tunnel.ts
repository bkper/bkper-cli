import fs from 'fs';
import { Tunnel, bin, install } from './cloudflared/index.js';
import type { Logger } from './logger.js';

/**
 * Handle to a running cloudflared tunnel.
 */
export interface TunnelHandle {
    /** The public URL assigned to the tunnel. */
    url: string;
    /** Stops the tunnel process. */
    stop(): Promise<void>;
}

/**
 * Options for starting a cloudflared tunnel.
 */
export interface CloudflaredTunnelOptions {
    /** The local port to tunnel. */
    port: number;
    /** Optional logger for status messages. */
    logger?: Logger;
}

/**
 * Starts a cloudflared Quick Tunnel to expose a local port to the internet.
 *
 * On first invocation, downloads the cloudflared binary to ~/.config/bkper/bin/.
 * Subsequent calls use the cached binary.
 *
 * @param options - Tunnel configuration options.
 * @returns A handle to the running tunnel with URL and stop method.
 * @throws If the tunnel fails to start or times out.
 */
export async function startCloudflaredTunnel(options: CloudflaredTunnelOptions): Promise<TunnelHandle> {
    const { port, logger } = options;

    // Lazy download: only install cloudflared when actually needed
    if (!fs.existsSync(bin)) {
        logger?.info('Downloading cloudflared (first time only)...');
        try {
            await install(bin);
            logger?.success(`cloudflared installed to ${bin}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Failed to install cloudflared: ${message}\n` +
                    'You can manually install cloudflared and set CLOUDFLARED_BIN environment variable.'
            );
        }
    }

    const tunnel = Tunnel.quick(`http://localhost:${port}`);

    // Wait for URL assignment with timeout
    const url = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            tunnel.stop();
            reject(new Error('Timed out waiting for tunnel URL (15s)'));
        }, 15000);

        tunnel.once('url', (assignedUrl: string) => {
            clearTimeout(timeout);
            resolve(assignedUrl);
        });

        tunnel.once('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
        });

        tunnel.once('exit', (code: number | null) => {
            clearTimeout(timeout);
            if (code !== 0 && code !== null) {
                reject(new Error(`cloudflared exited with code ${code}`));
            }
        });
    });

    logger?.info(`Tunnel assigned: ${url}`);

    return {
        url,
        async stop(): Promise<void> {
            tunnel.stop();
            // Wait for graceful shutdown with hard timeout
            await new Promise<void>(resolve => {
                const hardTimeout = setTimeout(resolve, 2000);
                tunnel.once('exit', () => {
                    clearTimeout(hardTimeout);
                    resolve();
                });
            });
        },
    };
}
