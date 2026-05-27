import type { Miniflare } from 'miniflare';
import { watch as fsWatch, type FSWatcher } from 'node:fs';
import path from 'path';
import fs from 'fs';
import {
    createWorkerServer,
    reloadWorker,
    updateWorkerCode,
    stopWorkerServer,
} from '../../dev/miniflare.js';
import { watchWorker, type WatchHandle } from '../../dev/esbuild.js';
import { ensureTypesUpToDate, loadDevVars } from '../../dev/types.js';
import { createLogger, logDevServerBanner } from '../../dev/logger.js';
import { buildSharedIfPresent } from '../../dev/shared.js';
import { preflightDependencies } from '../../dev/preflight.js';
import { createLocalOutboundService } from '../../dev/local-outbound.js';
import { loadAppConfig, loadSourceDeploymentConfig } from './config.js';
import { isLoggedIn } from '../../auth/local-auth-service.js';
import { startCloudflaredTunnel, TunnelHandle } from '../../dev/tunnel.js';
import { updateWebhookUrlDev } from '../../dev/webhook-dev.js';
import { runCleanupStep } from '../../dev/cleanup.js';

/**
 * Options for the dev command
 */
export interface DevOptions {
    /** Server simulation port (default: 8787) */
    serverPort?: number;
}

/**
 * Starts the platform development environment.
 * Runs one Worker runtime (Miniflare), esbuild watch, and an optional tunnel to /events.
 *
 * Client tooling (Vite) is the template's responsibility — run it separately
 * via `vite dev` or the template's `npm run dev` script (which uses concurrently).
 *
 * @param options - Dev command options
 */
export async function dev(options: DevOptions = {}): Promise<void> {
    const serverLogger = createLogger('server');
    const typesLogger = createLogger('types');
    const sharedLogger = createLogger('shared');

    const appConfig = loadAppConfig();
    const deployConfig = loadSourceDeploymentConfig();

    if (!deployConfig) {
        console.error('No deployment configuration found in bkper.yaml');
        console.error('Expected format:');
        console.error('  deployment:');
        console.error('    server: server/src/index.ts');
        console.error('    client: client');
        process.exit(1);
    }

    typesLogger.info('Checking types...');
    ensureTypesUpToDate(
        {
            services: deployConfig.services,
            secrets: deployConfig.secrets,
            hasStaticAssets: !!deployConfig.client,
        },
        process.cwd()
    );

    const preflight = preflightDependencies(process.cwd(), {
        requireMiniflare: true,
    });
    if (!preflight.ok) {
        console.error(preflight.message);
        process.exit(1);
    }

    sharedLogger.info('Building shared package...');
    const sharedBuild = await buildSharedIfPresent(process.cwd());
    if (!sharedBuild.success) {
        sharedLogger.error('Shared package build failed');
        if (sharedBuild.diagnostics) {
            for (const diagnostic of sharedBuild.diagnostics) {
                sharedLogger.error(diagnostic);
            }
        }
        process.exit(1);
    }
    if (sharedBuild.built) {
        sharedLogger.success('Shared package built');
    } else {
        sharedLogger.info('No shared package found');
    }

    const devVars = loadDevVars(process.cwd(), deployConfig.secrets || []);
    const serverPort = options.serverPort || 8787;
    const hasEvents = Array.isArray(appConfig.events) && appConfig.events.length > 0;

    let mf: Miniflare | null = null;
    let eventsTunnel: TunnelHandle | null = null;
    let eventsUrl: string | undefined;
    let serverWatchHandle: WatchHandle | null = null;
    let sharedWatcher: FSWatcher | null = null;

    let cleaningUp = false;
    let cleanupKeepAlive: ReturnType<typeof setInterval> | null = null;
    const cleanup = async () => {
        if (cleaningUp) return;
        cleaningUp = true;
        process.exitCode = 0;
        if (!cleanupKeepAlive) {
            cleanupKeepAlive = setInterval(() => {}, 1000);
        }
        process.stdout.write('\n\nShutting down...');

        const appId = appConfig.id;
        const warnings: string[] = [];

        await Promise.allSettled(
            [
                runCleanupStep({
                    label: 'server-watch',
                    timeoutMs: 5000,
                    action: async () => {
                        if (serverWatchHandle) await serverWatchHandle.dispose();
                    },
                }),
                runCleanupStep({
                    label: 'shared-watch',
                    timeoutMs: 5000,
                    action: async () => {
                        if (sharedWatcher) sharedWatcher.close();
                    },
                }),
                runCleanupStep({
                    label: 'server',
                    timeoutMs: 5000,
                    action: async () => {
                        if (mf) await stopWorkerServer(mf);
                    },
                }),
                runCleanupStep({
                    label: 'tunnel',
                    timeoutMs: 5000,
                    action: async () => {
                        if (eventsTunnel) await eventsTunnel.stop();
                    },
                }),
                runCleanupStep({
                    label: 'webhookUrlDev',
                    timeoutMs: 5000,
                    action: async () => {
                        if (hasEvents && appId && isLoggedIn()) {
                            await updateWebhookUrlDev(appId, null);
                        }
                    },
                }),
            ].map(step =>
                step.catch(err => {
                    warnings.push(err.message);
                })
            )
        );

        if (warnings.length > 0) {
            console.log(` (${warnings.join(', ')})`);
        } else {
            console.log(' done.');
        }
        if (cleanupKeepAlive) {
            clearInterval(cleanupKeepAlive);
            cleanupKeepAlive = null;
        }
        process.exit(0);
    };
    process.on('exit', () => {
        if (!cleaningUp) {
            console.log('\n\nShutting down... done.');
        }
    });
    process.stdin.resume();

    const sharedDir = path.join(process.cwd(), 'packages/shared/src');
    let sharedBuildInProgress = false;
    let sharedBuildPending = false;
    let sharedDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const rebuildShared = async (): Promise<void> => {
        if (sharedBuildInProgress) {
            sharedBuildPending = true;
            return;
        }

        sharedBuildInProgress = true;
        try {
            sharedLogger.info('Rebuilding shared package...');
            const result = await buildSharedIfPresent(process.cwd());
            if (!result.success) {
                sharedLogger.error('Shared package build failed');
                if (result.diagnostics) {
                    for (const diagnostic of result.diagnostics) {
                        sharedLogger.error(diagnostic);
                    }
                }
                return;
            }

            if (result.built) {
                sharedLogger.success('Shared package rebuilt');
            }

            if (mf) {
                serverLogger.info('Reloading server after shared update...');
                await reloadWorker(mf, deployConfig.server);
                serverLogger.success('Server reloaded');
            }
        } catch (err) {
            sharedLogger.error(`Shared rebuild failed: ${err}`);
        } finally {
            sharedBuildInProgress = false;
            if (sharedBuildPending) {
                sharedBuildPending = false;
                setTimeout(rebuildShared, 100);
            }
        }
    };

    if (fs.existsSync(sharedDir)) {
        sharedWatcher = fsWatch(sharedDir, { recursive: true }, (_event, filename) => {
            if (filename && filename.includes('node_modules')) return;
            sharedLogger.info(`Change detected: ${filename}`);
            if (sharedDebounceTimer) {
                clearTimeout(sharedDebounceTimer);
            }
            sharedDebounceTimer = setTimeout(rebuildShared, 200);
        });
    }

    serverLogger.info('Starting server...');
    const outboundService = appConfig.id
        ? createLocalOutboundService({ appId: appConfig.id })
        : undefined;
    mf = await createWorkerServer(deployConfig.server, {
        port: serverPort,
        kvNamespaces: deployConfig.services?.includes('KV') ? ['KV'] : [],
        vars: devVars,
        compatibilityDate: deployConfig.compatibilityDate,
        persist: true,
        outboundService,
    });

    serverWatchHandle = await watchWorker(deployConfig.server, async code => {
        serverLogger.info('Rebuilding server...');
        try {
            await updateWorkerCode(mf!, code);
            serverLogger.success('Server reloaded');
        } catch (err) {
            serverLogger.error(`Reload failed: ${err}`);
        }
    });

    if (hasEvents) {
        try {
            eventsTunnel = await startCloudflaredTunnel({
                port: serverPort,
                logger: serverLogger,
            });
            eventsUrl = `${eventsTunnel.url}/events`;
            serverLogger.success('Events tunnel ready');
        } catch (err) {
            serverLogger.error(`Tunnel failed: ${err}`);
            process.exit(1);
        }

        if (appConfig.id) {
            if (!isLoggedIn()) {
                serverLogger.warn('Not logged in. Skipping webhookUrlDev update.');
            } else {
                try {
                    await updateWebhookUrlDev(appConfig.id, eventsUrl || null);
                    serverLogger.success('webhookUrlDev updated');
                } catch (err) {
                    serverLogger.warn(`Failed to update webhookUrlDev: ${err}`);
                }
            }
        }
    }

    logDevServerBanner({
        tunnelUrl: hasEvents && eventsTunnel ? eventsUrl : undefined,
    });

    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.once('SIGINT', async () => {
        process.exitCode = 0;
        await cleanup();
    });
    process.once('SIGTERM', async () => {
        process.exitCode = 0;
        await cleanup();
    });
    process.once('uncaughtException', async err => {
        serverLogger.warn(
            `Uncaught exception: ${err instanceof Error ? err.message : String(err)}`
        );
        try {
            await cleanup();
        } catch {
            process.exit(1);
        }
    });
    process.once('unhandledRejection', async reason => {
        serverLogger.warn(
            `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`
        );
        try {
            await cleanup();
        } catch {
            process.exit(1);
        }
    });
}
