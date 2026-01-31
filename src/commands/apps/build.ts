import { buildWorkerToFile } from "../../dev/esbuild.js";
import { buildClient } from "../../dev/vite.js";
import { ensureTypesUpToDate } from "../../dev/types.js";
import { createLogger, formatSize } from "../../dev/logger.js";
import { buildSharedIfPresent } from "../../dev/shared.js";
import { preflightDependencies } from "../../dev/preflight.js";
import { loadSourceDeploymentConfig } from "./config.js";
import { statSync, existsSync, mkdirSync, readdirSync } from "fs";
import path from "path";

/**
 * Gets the total size of a directory in bytes
 *
 * @param dirPath - Path to the directory
 * @returns Total size in bytes
 */
function getDirSize(dirPath: string): number {
    if (!existsSync(dirPath)) return 0;

    let totalSize = 0;
    const files = readdirSync(dirPath, { withFileTypes: true, recursive: true });

    for (const file of files) {
        if (file.isFile()) {
            const filePath = path.join(file.parentPath || dirPath, file.name);
            totalSize += statSync(filePath).size;
        }
    }

    return totalSize;
}

/**
 * Builds all configured handlers for deployment
 *
 * - Ensures types are up to date
 * - Builds web client (Vite) if configured
 * - Builds web server (esbuild) if configured
 * - Builds events handler (esbuild) if configured
 * - Reports build results with file sizes
 */
export async function build(): Promise<void> {
    const typesLogger = createLogger("types");
    const buildLogger = createLogger("build");
    const sharedLogger = createLogger("shared");

    // Get the project root (current working directory)
    const projectRoot = process.cwd();

    // Load configuration
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
        projectRoot
    );

    const clientRoot = deployConfig.web?.client
        ? path.resolve(projectRoot, deployConfig.web.client)
        : undefined;
    const preflight = preflightDependencies(projectRoot, clientRoot);
    if (!preflight.ok) {
        console.error(preflight.message);
        process.exit(1);
    }

    sharedLogger.info("Building shared package...");
    const sharedBuild = await buildSharedIfPresent(projectRoot);
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

    const hasWeb = !!deployConfig.web?.main;
    const hasEvents = !!deployConfig.events?.main;

    console.log("\n📦 Building Bkper App...\n");

    const results: {
        webClient?: { path: string; size: number };
        webServer?: { path: string; size: number };
        events?: { path: string; size: number };
    } = {};

    // Build web client (Vite)
    if (hasWeb && deployConfig.web?.client && clientRoot) {
        buildLogger.info("Building web client...");

        const clientOutDir = path.resolve(projectRoot, "dist/web/client");
        await buildClient(clientRoot, { outDir: clientOutDir });

        const clientSize = getDirSize(clientOutDir);
        results.webClient = { path: "dist/web/client/", size: clientSize };
        console.log(`   ✓ Web client    → dist/web/client/    (${formatSize(clientSize)})`);
    }

    // Build web server (esbuild)
    if (hasWeb) {
        buildLogger.info("Building web server...");

        const serverOutDir = path.resolve(projectRoot, "dist/web/server");
        const serverOutFile = path.join(serverOutDir, "index.js");
        const serverEntryPoint = path.resolve(projectRoot, deployConfig.web!.main);

        // Ensure output directory exists
        if (!existsSync(serverOutDir)) {
            mkdirSync(serverOutDir, { recursive: true });
        }

        await buildWorkerToFile(serverEntryPoint, serverOutFile);

        const serverSize = statSync(serverOutFile).size;
        results.webServer = { path: "dist/web/server/", size: serverSize };
        console.log(`   ✓ Web server    → dist/web/server/    (${formatSize(serverSize)})`);
    }

    // Build events handler (esbuild)
    if (hasEvents) {
        buildLogger.info("Building events handler...");

        const eventsOutDir = path.resolve(projectRoot, "dist/events");
        const eventsOutFile = path.join(eventsOutDir, "index.js");
        const eventsEntryPoint = path.resolve(projectRoot, deployConfig.events!.main);

        // Ensure output directory exists
        if (!existsSync(eventsOutDir)) {
            mkdirSync(eventsOutDir, { recursive: true });
        }

        await buildWorkerToFile(eventsEntryPoint, eventsOutFile);

        const eventsSize = statSync(eventsOutFile).size;
        results.events = { path: "dist/events/", size: eventsSize };
        console.log(`   ✓ Events        → dist/events/        (${formatSize(eventsSize)})`);
    }

    console.log("\n✅ Build complete\n");
}
