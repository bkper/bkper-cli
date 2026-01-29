import * as readline from "readline";
import fs from "fs";
import path from "path";
import { getOAuthToken, isLoggedIn } from "../../auth/local-auth-service.js";
import { setupBkper } from "../../bkper-factory.js";
import { createPlatformClient } from "../../platform/client.js";
import { createAssetManifest, readAssetFiles } from "./bundler.js";
import { handleError, loadAppConfig, loadDeploymentConfig } from "./config.js";
import { syncApp } from "./sync.js";
import type { DeployOptions, Environment, HandlerType } from "./types.js";

// =============================================================================
// Deploy
// =============================================================================

/**
 * Deploys the app to the Bkper Platform.
 *
 * @param options Deploy options (dev, events, sync)
 */
export async function deployApp(options: DeployOptions = {}): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Sync app config if requested
    if (options.sync) {
        console.log("Syncing app config...");
        setupBkper();
        const syncResult = await syncApp();
        console.log(`Synced ${syncResult.id} (${syncResult.action})`);
    }

    // 3. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkper.yaml or bkper.json not found");
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // Determine deploy type early
    const type: HandlerType = options.events ? "events" : "web";

    // 4. Load deployment configuration from bkper.yaml
    const deploymentConfig = loadDeploymentConfig();
    if (!deploymentConfig) {
        console.error("Error: No deployment configuration found in bkper.yaml");
        console.error("Add deployment section with web.bundle and events.bundle paths");
        process.exit(1);
    }

    // Get handler-specific config
    const handlerConfig = type === "events" 
        ? deploymentConfig.events 
        : deploymentConfig.web;

    if (!handlerConfig?.bundle) {
        console.error(`Error: No ${type} bundle path configured in bkper.yaml`);
        console.error(`Add deployment.${type}.bundle path`);
        process.exit(1);
    }

    // 5. Validate bundle path exists
    const bundleDir = handlerConfig.bundle;
    if (!fs.existsSync(bundleDir)) {
        console.error(`Error: Bundle directory not found: ${bundleDir}`);
        console.error("Please ensure you have run 'bun run build' or update bkperapp.yaml");
        process.exit(1);
    }

    // 6. Read bundle file (default to index.js)
    const bundlePath = path.join(bundleDir, "index.js");
    if (!fs.existsSync(bundlePath)) {
        console.error(`Error: Bundle file not found: ${bundlePath}`);
        console.error("Expected index.js in the bundle directory");
        process.exit(1);
    }

    console.log(`Reading bundle from ${bundlePath}...`);
    const bundle = fs.readFileSync(bundlePath);
    const bundleSizeKB = (bundle.length / 1024).toFixed(2);
    console.log(`Bundle size: ${bundleSizeKB} KB`);

    // 7. Validate and create asset manifest if configured (only for web handler)
    let assetManifest: Record<string, { hash: string; size: number }> | undefined;
    let assetFiles: Record<string, string> | undefined;
    if (type === "web" && handlerConfig.assets) {
        const assetsDir = handlerConfig.assets;
        if (!fs.existsSync(assetsDir)) {
            console.error(`Error: Assets directory not found: ${assetsDir}`);
            console.error("Please ensure assets are built or update bkper.yaml");
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
            const totalSizeMB = Object.values(assetFiles).reduce((sum, base64) => {
                return sum + (base64.length * 0.75); // base64 is ~1.33x original size
            }, 0) / 1024 / 1024;
            console.log(`  Total size: ${totalSizeMB.toFixed(2)} MB`);
        } catch (err) {
            console.error("Error processing assets:", err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }

    // 8. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 9. Call Platform API
    const env: Environment = options.dev ? "dev" : "prod";
    console.log(`Deploying ${type} handler to ${env}...`);

    // Build query params, mapping services to bindings for the API
    const bindings = deploymentConfig?.services ? { kv: deploymentConfig.services.filter(s => s === 'KV') } : undefined;
    const queryParams: { env: Environment; type: HandlerType; bindings?: string } = { env, type };
    if (bindings?.kv && bindings.kv.length > 0) {
        queryParams.bindings = JSON.stringify(bindings);
    }

    // Create multipart form data
    const formData = new FormData();
    formData.append('bundle', new Blob([bundle], { type: 'application/javascript+module' }));
    if (assetManifest) {
        formData.append('assetManifest', JSON.stringify(assetManifest));
    }
    if (assetFiles) {
        formData.append('assetFiles', JSON.stringify(assetFiles));
    }

    // Note: Do NOT set Content-Type header manually - fetch will set it automatically
    // with the proper boundary when using FormData
    const { data, error } = await client.POST("/api/apps/{appId}/deploy", {
        params: {
            path: { appId: config.id },
            query: queryParams,
        },
        body: formData as unknown as string,
        bodySerializer: (body) => body as unknown as globalThis.ReadableStream,
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    console.log(`\nDeployed ${type} handler to ${env}`);
    console.log(`  URL: ${data.url}${type === "events" ? "/events" : ""}`);
    console.log(`  Namespace: ${data.namespace}`);
    console.log(`  Script: ${data.scriptName}`);
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

    return new Promise((resolve) => {
        rl.question(
            `\nWARNING: This will permanently delete all data for '${appId}'.\nType the app name to confirm: `,
            (answer) => {
                rl.close();
                resolve(answer === appId);
            }
        );
    });
}

/**
 * Removes the app from the Bkper Platform.
 *
 * @param options Undeploy options (dev, events, deleteData)
 */
export async function undeployApp(options: DeployOptions = {}): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkper.yaml or bkper.json not found");
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
            console.log("Data deletion cancelled.");
            return;
        }
    }

    // 4. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 5. Call Platform API
    const env: Environment = options.dev ? "dev" : "prod";
    const type: HandlerType = options.events ? "events" : "web";
    console.log(`Removing ${type} handler from ${env}...`);

    // Build query params
    const queryParams: { env: Environment; type: HandlerType; deleteData?: boolean } = { env, type };
    if (options.deleteData) {
        queryParams.deleteData = true;
    }

    const { data, error } = await client.DELETE("/api/apps/{appId}", {
        params: {
            path: { appId: config.id },
            query: queryParams,
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    console.log(`\nRemoved ${type} handler from ${env}`);
    if (options.deleteData) {
        console.log("All associated data has been permanently deleted.");
    }
}

// =============================================================================
// Status
// =============================================================================

/**
 * Shows the deployment status for the app.
 */
export async function statusApp(): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Load bkper.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkper.yaml or bkper.json not found");
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // 3. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 4. Call Platform API
    console.log(`Fetching status for ${config.id}...`);

    const { data, error } = await client.GET("/api/apps/{appId}", {
        params: {
            path: { appId: config.id },
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    // 5. Display status
    console.log(`\nApp: ${data.appId}\n`);

    console.log("Production:");
    if (data.prod.web?.deployed) {
        console.log(`  Web:    ${data.prod.web.url} (deployed ${data.prod.web.updatedAt})`);
    } else {
        console.log("  Web:    (not deployed)");
    }
    if (data.prod.events?.deployed) {
        console.log(`  Events: ${data.prod.events.url} (deployed ${data.prod.events.updatedAt})`);
    } else {
        console.log("  Events: (not deployed)");
    }

    console.log("\nDevelopment:");
    if (data.dev.web?.deployed) {
        console.log(`  Web:    ${data.dev.web.url} (deployed ${data.dev.web.updatedAt})`);
    } else {
        console.log("  Web:    (not deployed)");
    }
    if (data.dev.events?.deployed) {
        console.log(`  Events: ${data.dev.events.url} (deployed ${data.dev.events.updatedAt})`);
    } else {
        console.log("  Events: (not deployed)");
    }
}
