import { buildWorkerToFile } from '../../dev/esbuild.js';
import { ensureTypesUpToDate } from '../../dev/types.js';
import { createLogger, formatSize } from '../../dev/logger.js';
import { buildSharedIfPresent } from '../../dev/shared.js';
import { preflightDependencies } from '../../dev/preflight.js';
import { loadSourceDeploymentConfig } from './config.js';
import { statSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * Builds all configured worker handlers for deployment.
 *
 * - Ensures types are up to date (generates env.d.ts)
 * - Builds shared package if present
 * - Builds web server worker (esbuild) if configured
 * - Builds events handler worker (esbuild) if configured
 * - Reports build results with file sizes
 *
 * Note: Client build (Vite) is the template's responsibility.
 * Use `vite build` or the template's build script for the client.
 */
export async function build(): Promise<void> {
    const typesLogger = createLogger('types');
    const buildLogger = createLogger('build');
    const sharedLogger = createLogger('shared');

    // Get the project root (current working directory)
    const projectRoot = process.cwd();

    // Load configuration
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

    // Ensure types are up to date
    typesLogger.info('Checking types...');
    ensureTypesUpToDate(
        {
            services: deployConfig.services,
            secrets: deployConfig.secrets,
            hasStaticAssets: !!deployConfig.web?.client,
        },
        projectRoot
    );

    const preflight = preflightDependencies(projectRoot);
    if (!preflight.ok) {
        console.error(preflight.message);
        process.exit(1);
    }

    sharedLogger.info('Building shared package...');
    const sharedBuild = await buildSharedIfPresent(projectRoot);
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

    const hasWeb = !!deployConfig.web?.main;
    const hasEvents = !!deployConfig.events?.main;

    console.log('\n\uD83D\uDCE6 Building Bkper App...\n');

    const results: {
        webServer?: { path: string; size: number };
        events?: { path: string; size: number };
    } = {};

    // Build web server (esbuild)
    if (hasWeb) {
        buildLogger.info('Building web server...');

        const serverOutDir = path.resolve(projectRoot, 'dist/web/server');
        const serverOutFile = path.join(serverOutDir, 'index.js');
        const serverEntryPoint = path.resolve(projectRoot, deployConfig.web!.main);

        // Ensure output directory exists
        if (!existsSync(serverOutDir)) {
            mkdirSync(serverOutDir, { recursive: true });
        }

        await buildWorkerToFile(serverEntryPoint, serverOutFile);

        const serverSize = statSync(serverOutFile).size;
        results.webServer = { path: 'dist/web/server/', size: serverSize };
        console.log(
            `   \u2713 Web server    \u2192 dist/web/server/    (${formatSize(serverSize)})`
        );
    }

    // Build events handler (esbuild)
    if (hasEvents) {
        buildLogger.info('Building events handler...');

        const eventsOutDir = path.resolve(projectRoot, 'dist/events');
        const eventsOutFile = path.join(eventsOutDir, 'index.js');
        const eventsEntryPoint = path.resolve(projectRoot, deployConfig.events!.main);

        // Ensure output directory exists
        if (!existsSync(eventsOutDir)) {
            mkdirSync(eventsOutDir, { recursive: true });
        }

        await buildWorkerToFile(eventsEntryPoint, eventsOutFile);

        const eventsSize = statSync(eventsOutFile).size;
        results.events = { path: 'dist/events/', size: eventsSize };
        console.log(
            `   \u2713 Events        \u2192 dist/events/        (${formatSize(eventsSize)})`
        );
    }

    console.log('\n\u2705 Build complete\n');
}
