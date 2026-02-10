import { Miniflare } from 'miniflare';
import { ViteDevServer } from 'vite';
import { watch } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { createWorkerServer, reloadWorker, stopWorkerServer } from '../../dev/miniflare.js';
import { createClientServer, stopClientServer, getServerUrl } from '../../dev/vite.js';
import { ensureTypesUpToDate, loadDevVars } from '../../dev/types.js';
import { createLogger, logDevServerBanner } from '../../dev/logger.js';
import { buildSharedIfPresent } from '../../dev/shared.js';
import { preflightDependencies } from '../../dev/preflight.js';
import { loadAppConfig, loadSourceDeploymentConfig } from './config.js';
import { isLoggedIn } from '../../auth/local-auth-service.js';
import { startCloudflaredTunnel, TunnelHandle } from '../../dev/tunnel.js';
import { updateWebhookUrlDev } from '../../dev/webhook-dev.js';
import { runCleanupStep } from '../../dev/cleanup.js';

/**
 * Options for the dev command
 */
export interface DevOptions {
    /** Client dev server port (default: 5173) */
    clientPort?: number;
    /** Server simulation port (default: 8787) */
    serverPort?: number;
    /** Events handler port (default: 8791) */
    eventsPort?: number;
    /** Run only the web handler */
    web?: boolean;
    /** Run only the events handler */
    events?: boolean;
    /** Open browser on startup (default: true) */
    open?: boolean;
}

/**
 * Starts the full development environment.
 * Auto-detects what's configured and runs it:
 *
 * - If web is configured: starts Vite + Miniflare
 * - If events is configured: runs locally with tunnel
 *
 * @param options - Dev command options
 */
export async function dev(options: DevOptions = {}): Promise<void> {
    const serverLogger = createLogger('server');
    const eventsLogger = createLogger('events');
    const typesLogger = createLogger('types');
    const sharedLogger = createLogger('shared');

    // Load configuration
    const appConfig = loadAppConfig();
    const deployConfig = loadSourceDeploymentConfig();

    if (!deployConfig) {
        console.error('No deployment configuration found in bkper.yaml');
        console.error('Expected format:');
        console.error('  deployment:');
        console.error('    web:');
        console.error('      main: packages/web/server/src/index.ts');
        console.error('      client: packages/web/client');
        process.exit(1);
    }

    // Check what's configured in bkper.yaml
    const webConfigured = !!deployConfig.web?.main;
    const eventsConfigured = !!deployConfig.events?.main;

    // Validate flags against configuration (early validation before heavy operations)
    if (options.web && !webConfigured) {
        console.error('--web specified but no web handler configured in bkper.yaml');
        process.exit(1);
    }
    if (options.events && !eventsConfigured) {
        console.error('--events specified but no events handler configured in bkper.yaml');
        process.exit(1);
    }

    // Determine what to run based on flags
    // If no flags specified, run everything configured (backwards compatible)
    // If flags specified, run only what's requested
    const explicitMode = options.web || options.events;
    const hasWeb = webConfigured && (!explicitMode || options.web);
    const hasEvents = eventsConfigured && (!explicitMode || options.events);

    // Ensure types are up to date
    typesLogger.info('Checking types...');
    ensureTypesUpToDate(
        {
            services: deployConfig.services,
            secrets: deployConfig.secrets,
            hasStaticAssets: !!deployConfig.web?.client,
        },
        process.cwd()
    );

    const clientRoot = deployConfig.web?.client
        ? path.resolve(process.cwd(), deployConfig.web.client)
        : undefined;
    const preflight = preflightDependencies(process.cwd(), clientRoot);
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

    // Load dev vars (secrets for local development)
    const devVars = loadDevVars(process.cwd(), deployConfig.secrets || []);

    const clientPort = options.clientPort || 5173;
    const serverPort = options.serverPort || 8787;
    const eventsPort = options.eventsPort || 8791;

    let mf: Miniflare | null = null;
    let eventsMf: Miniflare | null = null;
    let vite: ViteDevServer | null = null;
    let eventsTunnel: TunnelHandle | null = null;
    let eventsUrl: string | undefined;

    // Handle graceful shutdown
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

        // Run all cleanup in parallel, collect warnings
        await Promise.allSettled(
            [
                runCleanupStep({
                    label: 'vite',
                    timeoutMs: 5000,
                    action: async () => {
                        if (vite) await stopClientServer(vite);
                    },
                }),
                runCleanupStep({
                    label: 'web',
                    timeoutMs: 5000,
                    action: async () => {
                        if (mf) await stopWorkerServer(mf);
                    },
                }),
                runCleanupStep({
                    label: 'events',
                    timeoutMs: 5000,
                    action: async () => {
                        if (eventsMf) await stopWorkerServer(eventsMf);
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

    // Start web server (Miniflare)
    if (hasWeb) {
        serverLogger.info('Starting server...');
        mf = await createWorkerServer(deployConfig.web!.main, {
            port: serverPort,
            kvNamespaces: deployConfig.services?.includes('KV') ? ['KV'] : [],
            vars: devVars,
            compatibilityDate: deployConfig.compatibilityDate,
            persist: true,
        });

        // Start web client (Vite)
        if (deployConfig.web!.client) {
            vite = await createClientServer(deployConfig.web!.client, {
                port: clientPort,
                serverPort,
                open: options.open !== false,
            });
        }

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

                if (hasWeb && mf) {
                    serverLogger.info('Reloading server after shared update...');
                    await reloadWorker(mf, deployConfig.web!.main);
                    serverLogger.success('Server reloaded');
                }

                if (hasEvents && eventsMf) {
                    eventsLogger.info('Reloading events after shared update...');
                    await reloadWorker(eventsMf, deployConfig.events!.main);
                    eventsLogger.success('Events reloaded');
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
            watch(sharedDir, {
                ignoreInitial: true,
                ignored: /node_modules/,
            }).on('change', file => {
                sharedLogger.info(`Change detected: ${path.basename(file)}`);
                if (sharedDebounceTimer) {
                    clearTimeout(sharedDebounceTimer);
                }
                sharedDebounceTimer = setTimeout(rebuildShared, 200);
            });
        }

        // Watch server files for hot reload
        const serverDir = path.dirname(deployConfig.web!.main);
        watch(serverDir, {
            ignoreInitial: true,
            ignored: /node_modules/,
        }).on('change', async file => {
            serverLogger.info(`${path.basename(file)} changed, reloading...`);
            try {
                await reloadWorker(mf!, deployConfig.web!.main);
                serverLogger.success('Server reloaded');
            } catch (err) {
                serverLogger.error(`Reload failed: ${err}`);
            }
        });
    }

    // Watch events files for local reload
    if (hasEvents) {
        eventsLogger.info('Starting events server...');
        eventsMf = await createWorkerServer(deployConfig.events!.main, {
            port: eventsPort,
            kvNamespaces: deployConfig.services?.includes('KV') ? ['KV'] : [],
            vars: devVars,
            compatibilityDate: deployConfig.compatibilityDate,
            persist: true,
            persistPath: './.mf/kv-events',
        });

        try {
            eventsTunnel = await startCloudflaredTunnel({
                port: eventsPort,
                logger: eventsLogger,
            });
            eventsUrl = `${eventsTunnel.url}/events`;
            eventsLogger.success('Tunnel ready');
        } catch (err) {
            eventsLogger.error(`Tunnel failed: ${err}`);
            process.exit(1);
        }

        if (appConfig.id) {
            if (!isLoggedIn()) {
                eventsLogger.warn('Not logged in. Skipping webhookUrlDev update.');
            } else {
                try {
                    await updateWebhookUrlDev(appConfig.id, eventsUrl || null);
                    eventsLogger.success('webhookUrlDev updated');
                } catch (err) {
                    eventsLogger.warn(`Failed to update webhookUrlDev: ${err}`);
                }
            }
        }

        const eventsDir = path.dirname(deployConfig.events!.main);
        let eventsReloadInProgress = false;
        let eventsReloadPending = false;
        let eventsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        const reloadEvents = async (): Promise<void> => {
            if (!eventsMf) return;
            if (eventsReloadInProgress) {
                eventsReloadPending = true;
                return;
            }

            eventsReloadInProgress = true;
            try {
                eventsLogger.info('Reloading events...');
                await reloadWorker(eventsMf, deployConfig.events!.main);
                eventsLogger.success('Events reloaded');
            } catch (err) {
                eventsLogger.error(`Events reload failed: ${err}`);
            } finally {
                eventsReloadInProgress = false;
                if (eventsReloadPending) {
                    eventsReloadPending = false;
                    setTimeout(reloadEvents, 100);
                }
            }
        };

        watch(eventsDir, {
            ignoreInitial: true,
            ignored: /node_modules/,
        }).on('change', file => {
            eventsLogger.info(`Change detected: ${path.basename(file)}`);
            if (eventsDebounceTimer) clearTimeout(eventsDebounceTimer);
            eventsDebounceTimer = setTimeout(reloadEvents, 200);
        });
    }

    // Display status
    logDevServerBanner({
        clientUrl: hasWeb && vite ? getServerUrl(vite) : undefined,
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
        eventsLogger.warn(
            `Uncaught exception: ${err instanceof Error ? err.message : String(err)}`
        );
        try {
            await cleanup();
        } catch {
            process.exit(1);
        }
    });
    process.once('unhandledRejection', async reason => {
        eventsLogger.warn(
            `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`
        );
        try {
            await cleanup();
        } catch {
            process.exit(1);
        }
    });
}
