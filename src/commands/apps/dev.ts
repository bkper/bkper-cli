import { Miniflare } from "miniflare";
import { ViteDevServer } from "vite";
import { watch } from "chokidar";
import path from "path";
import fs from "fs";
import { createWorkerServer, reloadWorker, stopWorkerServer } from "../../dev/miniflare.js";
import { createClientServer, stopClientServer, getServerUrl } from "../../dev/vite.js";
import { buildWorkerToFile } from "../../dev/esbuild.js";
import { ensureTypesUpToDate, loadDevVars } from "../../dev/types.js";
import { createLogger, logDevServerBanner } from "../../dev/logger.js";
import { buildSharedIfPresent } from "../../dev/shared.js";
import { preflightDependencies } from "../../dev/preflight.js";
import { loadAppConfig, loadSourceDeploymentConfig } from "./config.js";
import { getOAuthToken, isLoggedIn } from "../../auth/local-auth-service.js";
import { createPlatformClient } from "../../platform/client.js";
import type { Environment, HandlerType, ErrorResponse } from "./types.js";

/**
 * Options for the dev command
 */
export interface DevOptions {
    /** Client dev server port (default: 5173) */
    port?: number;
    /** Server simulation port (default: 8787) */
    serverPort?: number;
}

/**
 * Deploys a handler to the Bkper Platform programmatically.
 * This is a simplified version of deployApp for use in the dev command.
 *
 * @param appId - The app ID
 * @param type - Handler type ('web' or 'events')
 * @param env - Environment ('dev' or 'prod')
 * @param bundlePath - Path to the built bundle
 */
async function deployHandler(
    appId: string,
    type: HandlerType,
    env: Environment,
    bundlePath: string
): Promise<void> {
    // Check if logged in
    if (!isLoggedIn()) {
        throw new Error("Not logged in. Run: bkper login");
    }

    // Read bundle file
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found: ${bundlePath}`);
    }

    const bundle = fs.readFileSync(bundlePath);

    // Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // Create multipart form data
    const formData = new FormData();
    formData.append('bundle', new Blob([bundle], { type: 'application/javascript+module' }));

    // Call Platform API
    const { error } = await client.POST("/api/apps/{appId}/deploy", {
        params: {
            path: { appId },
            query: { env, type },
        },
        body: formData as unknown as string,
        bodySerializer: (body) => body as unknown as globalThis.ReadableStream,
    });

    if (error) {
        const errResponse = error as ErrorResponse;
        throw new Error(errResponse.error?.message || "Deploy failed");
    }
}

/**
 * Starts the full development environment.
 * Auto-detects what's configured and runs it:
 *
 * - If web is configured: starts Vite + Miniflare
 * - If events is configured: watches and auto-deploys to dev
 *
 * @param options - Dev command options
 */
export async function dev(options: DevOptions = {}): Promise<void> {
    const serverLogger = createLogger("server");
    const eventsLogger = createLogger("events");
    const typesLogger = createLogger("types");
    const sharedLogger = createLogger("shared");

    // Load configuration
    const appConfig = loadAppConfig();
    const deployConfig = loadSourceDeploymentConfig();

    if (!deployConfig) {
        console.error("No deployment configuration found in bkper.yaml");
        console.error("Expected format:");
        console.error("  deployment:");
        console.error("    web:");
        console.error("      main: packages/web/server/src/index.ts");
        console.error("      client: packages/web/client");
        process.exit(1);
    }

    // Ensure types are up to date
    typesLogger.info("Checking types...");
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

    sharedLogger.info("Building shared package...");
    const sharedBuild = await buildSharedIfPresent(process.cwd());
    if (!sharedBuild.success) {
        sharedLogger.error("Shared package build failed");
        if (sharedBuild.diagnostics) {
            for (const diagnostic of sharedBuild.diagnostics) {
                sharedLogger.error(diagnostic);
            }
        }
        process.exit(1);
    }
    if (sharedBuild.built) {
        sharedLogger.success("Shared package built");
    } else {
        sharedLogger.info("No shared package found");
    }

    // Load dev vars (secrets for local development)
    const devVars = loadDevVars(process.cwd(), deployConfig.secrets || []);

    const clientPort = options.port || 5173;
    const serverPort = options.serverPort || 8787;
    const eventsUrl = `https://${appConfig.id}-dev.bkper.app/events`;

    const hasWeb = !!deployConfig.web?.main;
    const hasEvents = !!deployConfig.events?.main;

    let mf: Miniflare | null = null;
    let vite: ViteDevServer | null = null;

    // Handle graceful shutdown
    const cleanup = async () => {
        console.log("\n\nShutting down...");
        if (vite) await stopClientServer(vite);
        if (mf) await stopWorkerServer(mf);
        process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Start web server (Miniflare)
    if (hasWeb) {
        serverLogger.info("Starting server...");
        mf = await createWorkerServer(deployConfig.web!.main, {
            port: serverPort,
            kvNamespaces: deployConfig.services?.includes("KV") ? ["KV"] : [],
            vars: devVars,
            compatibilityDate: deployConfig.compatibilityDate,
            persist: true,
        });

        // Start web client (Vite)
        if (deployConfig.web!.client) {
            vite = await createClientServer(deployConfig.web!.client, {
                port: clientPort,
                serverPort,
            });
        }

    const sharedDir = path.join(process.cwd(), "packages/shared/src");
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
            sharedLogger.info("Rebuilding shared package...");
            const result = await buildSharedIfPresent(process.cwd());
            if (!result.success) {
                sharedLogger.error("Shared package build failed");
                if (result.diagnostics) {
                    for (const diagnostic of result.diagnostics) {
                        sharedLogger.error(diagnostic);
                    }
                }
                return;
            }

            if (result.built) {
                sharedLogger.success("Shared package rebuilt");
            }

            if (hasWeb && mf) {
                serverLogger.info("Reloading server after shared update...");
                await reloadWorker(mf, deployConfig.web!.main);
                serverLogger.success("Server reloaded");
            }

            if (hasEvents) {
                eventsLogger.info("Redeploying events after shared update...");
                await buildWorkerToFile(
                    deployConfig.events!.main,
                    "dist/events/index.js"
                );
                await deployHandler(appConfig.id!, "events", "dev", "dist/events/index.js");
                eventsLogger.success("Deployed");
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
        }).on("change", (file) => {
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
        }).on("change", async (file) => {
            serverLogger.info(`${path.basename(file)} changed, reloading...`);
            try {
                await reloadWorker(mf!, deployConfig.web!.main);
                serverLogger.success("Server reloaded");
            } catch (err) {
                serverLogger.error(`Reload failed: ${err}`);
            }
        });
    }

    // Watch events files for auto-deploy
    if (hasEvents) {
        const eventsDir = path.dirname(deployConfig.events!.main);
        const bundleOutPath = "dist/events/index.js";
        let deploying = false;
        let deployPending = false;

        const deployToDevDebounced = async () => {
            if (deploying) {
                deployPending = true;
                return;
            }
            deploying = true;

            try {
                eventsLogger.info("Building...");
                await buildWorkerToFile(
                    deployConfig.events!.main,
                    bundleOutPath
                );
                eventsLogger.info("Deploying to dev...");
                await deployHandler(appConfig.id!, "events", "dev", bundleOutPath);
                eventsLogger.success("Deployed");
            } catch (err) {
                eventsLogger.error(`Deploy failed: ${err}`);
            } finally {
                deploying = false;
                if (deployPending) {
                    deployPending = false;
                    // Process pending deploy
                    setTimeout(deployToDevDebounced, 100);
                }
            }
        };

        // Debounce file changes (500ms)
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        watch(eventsDir, {
            ignoreInitial: true,
            ignored: /node_modules/,
        }).on("change", (file) => {
            eventsLogger.info(`Change detected: ${path.basename(file)}`);
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(deployToDevDebounced, 500);
        });

        // Initial deploy
        eventsLogger.info("Initial deploy...");
        await deployToDevDebounced();
    }

    // Display status
    logDevServerBanner({
        clientUrl: hasWeb && vite ? getServerUrl(vite) : undefined,
        serverUrl: hasWeb ? `http://localhost:${serverPort}` : undefined,
        eventsUrl: hasEvents ? eventsUrl : undefined,
    });
}
