import * as readline from "readline";
import { getOAuthToken, isLoggedIn } from "../../auth/local-auth-service.js";
import { setupBkper } from "../../bkper-factory.js";
import { createPlatformClient } from "../../platform/client.js";
import { extractBindingsForApi, findWranglerConfig, parseWranglerConfig } from "../../utils/wrangler.js";
import { bundleProject } from "./bundler.js";
import { handleError, loadAppConfig } from "./config.js";
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

    // 3. Load bkperapp.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkperapp.yaml or bkperapp.json not found");
        process.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        process.exit(1);
    }

    // Determine deploy type early for bundling
    const type: HandlerType = options.events ? "events" : "web";

    // 4. Bundle the project
    console.log(`Bundling ${type} handler...`);
    let bundle: Buffer;
    try {
        bundle = await bundleProject(type);
    } catch (err) {
        console.error("Error bundling project:", err instanceof Error ? err.message : err);
        process.exit(1);
    }

    const bundleSizeKB = (bundle.length / 1024).toFixed(2);
    console.log(`Bundle size: ${bundleSizeKB} KB`);

    // 5. Parse wrangler.jsonc for bindings (optional)
    let bindings: { kv?: string[]; r2?: string[]; d1?: string[] } | undefined;
    const wranglerConfigPath = findWranglerConfig(type);
    if (wranglerConfigPath) {
        try {
            const wranglerConfig = parseWranglerConfig(wranglerConfigPath);
            bindings = extractBindingsForApi(wranglerConfig);
            if (bindings) {
                const bindingsList: string[] = [];
                if (bindings.kv) bindingsList.push(`KV: ${bindings.kv.join(", ")}`);
                if (bindings.r2) bindingsList.push(`R2: ${bindings.r2.join(", ")}`);
                if (bindings.d1) bindingsList.push(`D1: ${bindings.d1.join(", ")}`);
                console.log(`  Bindings: ${bindingsList.join("; ")}`);
            }
        } catch (err) {
            console.log(`  Warning: Could not parse wrangler config: ${err instanceof Error ? err.message : err}`);
        }
    }

    // 6. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 7. Call Platform API
    const env: Environment = options.dev ? "dev" : "prod";
    console.log(`Deploying ${type} handler to ${env}...`);

    // Build query params, including bindings if present
    const queryParams: { env: Environment; type: HandlerType; bindings?: string } = { env, type };
    if (bindings) {
        queryParams.bindings = JSON.stringify(bindings);
    }

    const { data, error } = await client.POST("/api/apps/{appId}/deploy", {
        params: {
            path: { appId: config.id },
            query: queryParams,
        },
        body: bundle as unknown as string,
        bodySerializer: (body) => body as unknown as globalThis.ReadableStream,
        headers: {
            "Content-Type": "application/octet-stream",
        },
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

    // 2. Load bkperapp.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkperapp.yaml or bkperapp.json not found");
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

    // 2. Load bkperapp.yaml/json to get app ID
    let config: bkper.App;
    try {
        config = loadAppConfig();
    } catch {
        console.error("Error: bkperapp.yaml or bkperapp.json not found");
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
