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
 * - Builds the server Worker (esbuild)
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
        console.error('    server: server/src/index.ts');
        console.error('    client: client');
        process.exit(1);
    }

    // Ensure types are up to date
    typesLogger.info('Checking types...');
    ensureTypesUpToDate(
        {
            services: deployConfig.services,
            secrets: deployConfig.secrets,
            hasStaticAssets: !!deployConfig.client,
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

    console.log('\n\uD83D\uDCE6 Building Bkper App...\n');

    buildLogger.info('Building server worker...');

    const serverOutDir = path.resolve(projectRoot, 'dist/server');
    const serverOutFile = path.join(serverOutDir, 'index.js');
    const serverEntryPoint = path.resolve(projectRoot, deployConfig.server);

    if (!existsSync(serverOutDir)) {
        mkdirSync(serverOutDir, { recursive: true });
    }

    await buildWorkerToFile(serverEntryPoint, serverOutFile);

    const serverSize = statSync(serverOutFile).size;
    console.log(`   \u2713 Server worker \u2192 dist/server/       (${formatSize(serverSize)})`);

    console.log('\n\u2705 Build complete\n');
}
