import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import { getStoredOAuthToken } from '../../auth/local-auth-service.js';
import { createPlatformClient } from '../../platform/client.js';
import { createAssetManifest, readAssetFiles } from './bundler.js';
import { handleError, loadAppConfig, loadSourceDeploymentConfig } from './config.js';
import type { DeployOptions, Environment, SourceDeploymentConfig } from './types.js';

interface PlatformDeployMetadata {
    bindings?: {
        kv_namespaces?: Array<{ binding: string }>;
    };
    compatibility_date?: string;
}

// =============================================================================
// Deploy
// =============================================================================

/**
 * Deploys the app to the Bkper Platform.
 *
 * @param options Deploy options
 */
export async function deployApp(options: DeployOptions = {}): Promise<void> {
    // 1. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error('Error: bkper.yaml or bkper.json not found');
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // 4. Load deployment configuration from bkper.yaml
    const deploymentConfig = loadSourceDeploymentConfig();
    if (!deploymentConfig) {
        console.error('Error: No deployment configuration found in bkper.yaml');
        console.error('Expected deployment section with server entry point');
        process.exit(1);
    }

    // 5. Resolve build outputs
    let resolvedPaths: { bundleDir: string; bundlePath: string; assetsDir?: string };
    try {
        resolvedPaths = resolveSourceDeployPaths(deploymentConfig);
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
    const { bundleDir, bundlePath, assetsDir } = resolvedPaths;

    // 6. Validate bundle outputs exist
    if (!fs.existsSync(bundleDir) || !fs.existsSync(bundlePath)) {
        console.error(
            "No build output found. Run your project's build script first (e.g. `npm run build`)."
        );
        process.exit(1);
    }

    console.log(`Reading bundle from ${bundlePath}...`);
    const bundle = fs.readFileSync(bundlePath);
    const bundleSizeKB = (bundle.length / 1024).toFixed(2);
    console.log(`Bundle size: ${bundleSizeKB} KB`);

    // 8. Validate and create asset manifest if configured
    let assetManifest: Record<string, { hash: string; size: number }> | undefined;
    let assetFiles: Record<string, string> | undefined;
    if (assetsDir) {
        if (!fs.existsSync(assetsDir)) {
            console.error(`Error: Assets directory not found: ${assetsDir}`);
            console.error('Please ensure assets are built or update bkper.yaml');
            process.exit(1);
        }

        console.log(`Creating asset manifest from ${assetsDir}...`);
        try {
            assetManifest = await createAssetManifest(assetsDir);
            const assetCount = Object.keys(assetManifest).length;
            console.log(`  ${assetCount} assets found`);

            // Read asset file contents for upload
            console.log(`Reading asset file contents...`);
            assetFiles = await readAssetFiles(assetsDir);
            const totalSizeMB =
                Object.values(assetFiles).reduce((sum, base64) => {
                    return sum + base64.length * 0.75; // base64 is ~1.33x original size
                }, 0) /
                1024 /
                1024;
            console.log(`  Total size: ${totalSizeMB.toFixed(2)} MB`);
        } catch (err) {
            console.error('Error processing assets:', err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }

    // 9. Create client using stored auth if available. If not, allow an external
    // proxy to inject auth or let the API return a clear authentication error.
    const token = await getStoredOAuthToken();
    const client = createPlatformClient(token);

    // 10. Call Platform API
    const env: Environment = options.preview ? 'preview' : 'production';
    console.log(`Deploying app to ${env}...`);

    const queryParams: { env: Environment } = { env };
    const metadata = buildPlatformDeployMetadata(deploymentConfig);

    // Create multipart form data
    const formData = new FormData();
    formData.append('bundle', new Blob([bundle], { type: 'application/javascript+module' }));
    if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
    }
    if (assetManifest) {
        formData.append('assetManifest', JSON.stringify(assetManifest));
    }
    if (assetFiles) {
        formData.append('assetFiles', JSON.stringify(assetFiles));
    }

    // Note: Do NOT set Content-Type header manually - fetch will set it automatically
    // with the proper boundary when using FormData
    const { data, error } = await client.POST('/api/apps/{appId}/deploy', {
        params: {
            path: { appId: config.id },
            query: queryParams,
        },
        body: formData as unknown as string,
        bodySerializer: body => body as unknown as globalThis.ReadableStream,
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error('Error: Unexpected empty response');
        process.exit(1);
    }

    console.log(`\nDeployed app to ${env}`);
    console.log(`  URL: ${data.url}`);
    console.log(`  Script: ${data.scriptName}`);
}

export function resolveSourceDeployPaths(
    deploymentConfig: SourceDeploymentConfig
): { bundleDir: string; bundlePath: string; assetsDir?: string } {
    if (!deploymentConfig.server) {
        throw new Error('No server worker configured');
    }

    const bundleDir = path.resolve('dist/server');
    const bundlePath = path.join(bundleDir, 'index.js');
    const assetsDir = deploymentConfig.client ? path.resolve('dist/client') : undefined;

    return { bundleDir, bundlePath, assetsDir };
}

export function buildPlatformDeployMetadata(
    deploymentConfig: SourceDeploymentConfig
): PlatformDeployMetadata | undefined {
    const metadata: PlatformDeployMetadata = {};
    const kvBindings = deploymentConfig.services
        ?.filter(service => service === 'KV')
        .map(binding => ({ binding }));

    if (kvBindings && kvBindings.length > 0) {
        metadata.bindings = { kv_namespaces: kvBindings };
    }

    if (deploymentConfig.compatibilityDate) {
        metadata.compatibility_date = deploymentConfig.compatibilityDate;
    }

    return metadata.bindings || metadata.compatibility_date ? metadata : undefined;
}

// =============================================================================
// Undeploy
// =============================================================================

/**
 * Prompts user to confirm data deletion by typing the app ID.
 *
 * @param appId - The app ID that must be typed to confirm
 * @returns true if confirmed, false otherwise
 */
async function confirmDeletion(appId: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => {
        rl.question(
            `\nWARNING: This will permanently delete all data for '${appId}'.\nType the app name to confirm: `,
            answer => {
                rl.close();
                resolve(answer === appId);
            }
        );
    });
}

/**
 * Removes the app from the Bkper Platform.
 *
 * @param options Undeploy options
 */
export async function undeployApp(options: DeployOptions = {}): Promise<void> {
    // 1. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error('Error: bkper.yaml or bkper.json not found');
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // 3. Handle --delete-data confirmation
    if (options.deleteData && !options.force) {
        const confirmed = await confirmDeletion(config.id);
        if (!confirmed) {
            console.log('Data deletion cancelled.');
            return;
        }
    }

    // 4. Create client using stored auth if available. If not, allow an external
    // proxy to inject auth or let the API return a clear authentication error.
    const token = await getStoredOAuthToken();
    const client = createPlatformClient(token);

    // 5. Call Platform API
    const env: Environment = options.preview ? 'preview' : 'production';
    console.log(`Removing app from ${env}...`);

    // Build query params
    const queryParams: { env: Environment; deleteData?: boolean } = {
        env,
    };
    if (options.deleteData) {
        queryParams.deleteData = true;
    }

    const { data, error } = await client.DELETE('/api/apps/{appId}', {
        params: {
            path: { appId: config.id },
            query: queryParams,
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error('Error: Unexpected empty response');
        process.exit(1);
    }

    console.log(`\nRemoved app from ${env}`);
    if (options.deleteData) {
        console.log('All associated data has been permanently deleted.');
    }
}

// =============================================================================
// Status
// =============================================================================

/**
 * Shows the deployment status for the app.
 */
export async function statusApp(): Promise<void> {
    // 1. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error('Error: bkper.yaml or bkper.json not found');
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // 3. Create client using stored auth if available. If not, allow an external
    // proxy to inject auth or let the API return a clear authentication error.
    const token = await getStoredOAuthToken();
    const client = createPlatformClient(token);

    // 4. Call Platform API
    console.log(`Fetching status for ${config.id}...`);

    const { data, error } = await client.GET('/api/apps/{appId}', {
        params: {
            path: { appId: config.id },
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error('Error: Unexpected empty response');
        process.exit(1);
    }

    // 5. Display status
    console.log(`\nApp: ${data.appId}\n`);

    console.log('Production:');
    if (data.prod?.deployed) {
        console.log(`  App: ${data.prod.url} (deployed ${data.prod.updatedAt})`);
    } else {
        console.log('  App: (not deployed)');
    }

    console.log('\nPreview:');
    if (data.preview?.deployed) {
        console.log(`  App: ${data.preview.url} (deployed ${data.preview.updatedAt})`);
    } else {
        console.log('  App: (not deployed)');
    }
}
