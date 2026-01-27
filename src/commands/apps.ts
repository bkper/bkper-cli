import { App, BkperError } from "bkper-js";
import { spawn } from "child_process";
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import * as readline from "readline";
import { Readable } from "stream";
import * as tar from "tar";
import * as YAML from "yaml";
import { getOAuthToken, isLoggedIn } from "../auth/local-auth-service.js";
import { getBkperInstance, setupBkper } from "../bkper-factory.js";
import { createPlatformClient } from "../platform/client.js";
import type { components } from "../platform/types.js";
import { extractBindingsForApi, findWranglerConfig, parseWranglerConfig } from "../utils/wrangler.js";
import { updateSkills } from "./skills.js";

// =============================================================================
// Types (from OpenAPI)
// =============================================================================

type DeployResult = components["schemas"]["DeployResult"];
type UndeployResult = components["schemas"]["UndeployResult"];
type AppStatus = components["schemas"]["AppStatus"];
type ErrorResponse = components["schemas"]["ErrorResponse"];

interface DeployOptions {
    dev?: boolean;
    events?: boolean;
    sync?: boolean;
    deleteData?: boolean;
    force?: boolean;
}

interface SyncResult {
    id: string;
    action: "created" | "updated";
}

// =============================================================================
// Existing Functions
// =============================================================================

/**
 * Lists all apps the authenticated user has access to.
 *
 * @returns Array of app data objects
 */
export async function listApps(): Promise<bkper.App[]> {
    const bkper = getBkperInstance();
    const apps = await bkper.getApps();
    return apps.map((app) => app.json());
}

/**
 * Loads app configuration from bkperapp.json or bkperapp.yaml in current directory.
 *
 * @returns App configuration object
 * @throws Error if no config file is found
 */
function loadAppConfig(): bkper.App {
    if (fs.existsSync("./bkperapp.json")) {
        return JSON.parse(fs.readFileSync("./bkperapp.json", "utf8"));
    } else if (fs.existsSync("./bkperapp.yaml")) {
        return YAML.parse(fs.readFileSync("./bkperapp.yaml", "utf8"));
    } else {
        throw new Error("bkperapp.json or bkperapp.yaml not found");
    }
}

/**
 * Loads README.md content if it exists.
 *
 * @returns README content or undefined
 */
function loadReadme(): string | undefined {
    if (fs.existsSync("./README.md")) {
        return fs.readFileSync("./README.md", "utf8");
    }
    return undefined;
}

/**
 * Creates an App instance configured from bkperapp.yaml and environment variables.
 *
 * @returns Configured App instance
 */
function createConfiguredApp(): App {
    const json = loadAppConfig();
    const app = new App(json);

    const readme = loadReadme();
    if (readme) {
        app.setReadme(readme);
    }

    return app;
}

/**
 * Creates a new app from the configuration in the current directory.
 *
 * @returns Created App instance
 */
export async function createApp(): Promise<App> {
    const app = createConfiguredApp();
    const createdApp = await app.create();
    return createdApp;
}

/**
 * Updates an existing app from the configuration in the current directory.
 *
 * @returns Updated App instance
 */
export async function updateApp(): Promise<App> {
    const app = createConfiguredApp();
    const updatedApp = await app.update();
    return updatedApp;
}

/**
 * Syncs app configuration to Bkper (creates if new, updates if exists).
 *
 * @returns Sync result with app id and action taken
 */
export async function syncApp(): Promise<SyncResult> {
    const bkper = getBkperInstance();
    const app = createConfiguredApp();
    const appId = app.getId();

    if (!appId) {
        throw new Error('App config is missing "id" field');
    }

    // Check if app exists
     let exists = false;
     try {
         await bkper.getApp(appId);
         exists = true;
     } catch (err) {
         if (err instanceof BkperError && err.code === 404) {
             // App doesn't exist, will create
             console.log("App does not exist, will create");
             exists = false;
         } else {
             throw err;
         }
     }

    if (exists) {
        await app.update();
        return { id: appId, action: "updated" };
    } else {
        await app.create();
        return { id: appId, action: "created" };
    }
}

// =============================================================================
// Deploy Functions
// =============================================================================

/**
 * Finds the entry point for bundling based on deploy type.
 * Supports both monorepo (bkper-app-template) and simple project structures.
 */
function findEntryPoint(type: 'web' | 'events'): string | null {
    // Monorepo candidates (for bkper-app-template structure)
    const monorepoWebCandidates = [
        "./packages/web/server/src/index.ts",
        "./packages/web/server/src/index.js",
        "./packages/web/src/index.ts",
        "./packages/web/src/index.js",
    ];

    const monorepoEventsCandidates = [
        "./packages/events/src/index.ts",
        "./packages/events/src/index.js",
    ];

    // Simple project candidates (for single worker projects)
    const simpleCandidates = [
        "./src/index.ts",
        "./src/index.js",
        "./index.ts",
        "./index.js",
    ];

    // Check monorepo first based on type, then fall back to simple
    const candidates =
        type === 'events'
            ? [...monorepoEventsCandidates, ...simpleCandidates]
            : [...monorepoWebCandidates, ...simpleCandidates];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

/**
 * Bundles the project using esbuild.
 *
 * @param type - The deploy type ('web' or 'events')
 * @returns Bundled JavaScript code as a Buffer
 */
async function bundleProject(type: 'web' | 'events'): Promise<Buffer> {
    const entryPoint = findEntryPoint(type);
    if (!entryPoint) {
        const expectedPaths = type === 'events'
            ? 'packages/events/src/index.ts or src/index.ts'
            : 'packages/web/server/src/index.ts or src/index.ts';
        throw new Error(
            `No entry point found for ${type} handler. Expected: ${expectedPaths}`
        );
    }

    console.log(`  Entry point: ${entryPoint}`);

    const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        format: "esm",
        platform: "neutral",
        target: "es2020",
        minify: true,
        write: false,
        external: [],
        conditions: ["workerd", "worker", "browser"],
        mainFields: ["browser", "module", "main"],
    });

    if (result.errors.length > 0) {
        const errorMessages = result.errors.map((e) => e.text).join("\n");
        throw new Error(`Bundle failed:\n${errorMessages}`);
    }

    if (!result.outputFiles || result.outputFiles.length === 0) {
        throw new Error("Bundle produced no output");
    }

    return Buffer.from(result.outputFiles[0].contents);
}

/**
 * Handles error response from Platform API
 */
function handleError(error: ErrorResponse): never {
    console.error(`Error: ${error.error.message}`);
    if (error.error.details) {
        console.error("Details:", JSON.stringify(error.error.details, null, 2));
    }
    process.exit(1);
}

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
    const type = options.events ? "events" : "web";

    // 3. Bundle the project
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

    // 4. Parse wrangler.jsonc for bindings (optional)
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

    // 5. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 6. Call Platform API
    const env = options.dev ? "dev" : "prod";
    console.log(`Deploying ${type} handler to ${env}...`);

    // Build query params, including bindings if present
    const queryParams: { env: "dev" | "prod"; type: "web" | "events"; bindings?: string } = { env, type };
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
    const env = options.dev ? "dev" : "prod";
    const type = options.events ? "events" : "web";
    console.log(`Removing ${type} handler from ${env}...`);

    // Build query params
    const queryParams: { env: "dev" | "prod"; type: "web" | "events"; deleteData?: boolean } = { env, type };
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

// =============================================================================
// Init Functions
// =============================================================================

const TEMPLATE_REPO = "bkper/bkper-app-template";
const TEMPLATE_BRANCH = "main";

/**
 * Validates that the app name is a valid npm package name.
 * Rules: lowercase, no spaces, starts with letter, only alphanumeric and hyphens
 */
function validateAppName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: "App name cannot be empty" };
    }

    if (!/^[a-z]/.test(name)) {
        return { valid: false, error: "App name must start with a lowercase letter" };
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
        return {
            valid: false,
            error: "App name can only contain lowercase letters, numbers, and hyphens",
        };
    }

    if (name.length > 214) {
        return { valid: false, error: "App name must be 214 characters or less" };
    }

    return { valid: true };
}

/**
 * Downloads and extracts the template tarball from GitHub.
 */
async function downloadTemplate(targetDir: string): Promise<void> {
    const tarballUrl = `https://github.com/${TEMPLATE_REPO}/archive/refs/heads/${TEMPLATE_BRANCH}.tar.gz`;

    const response = await fetch(tarballUrl, {
        headers: {
            "User-Agent": "bkper-cli",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
    }

    // Create parent directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Convert Web ReadableStream to Node.js Readable
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Failed to get response body reader");
    }

    const nodeStream = new Readable({
        async read() {
            const { done, value } = await reader.read();
            if (done) {
                this.push(null);
            } else {
                this.push(Buffer.from(value));
            }
        },
    });

    // Extract tarball, stripping the first directory component
    await new Promise<void>((resolve, reject) => {
        nodeStream
            .pipe(
                tar.extract({
                    cwd: targetDir,
                    strip: 1, // Remove the "bkper-app-template-main" prefix
                })
            )
            .on("finish", resolve)
            .on("error", reject);
    });
}

/**
 * Updates the bkperapp.yaml file with the new app name.
 */
function updateBkperAppYaml(projectDir: string, appName: string): void {
    const yamlPath = path.join(projectDir, "bkperapp.yaml");

    if (!fs.existsSync(yamlPath)) {
        throw new Error("bkperapp.yaml not found in template");
    }

    const content = fs.readFileSync(yamlPath, "utf8");
    const config = YAML.parse(content);

    // Update the id field
    config.id = appName;

    // Update the name field if it exists (make it more readable)
    if (config.name) {
        config.name = appName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    fs.writeFileSync(yamlPath, YAML.stringify(config), "utf8");
}

/**
 * Updates the package.json file with the new app name.
 */
function updatePackageJson(projectDir: string, appName: string): void {
    const packagePath = path.join(projectDir, "package.json");

    if (!fs.existsSync(packagePath)) {
        throw new Error("package.json not found in template");
    }

    const content = fs.readFileSync(packagePath, "utf8");
    const pkg = JSON.parse(content);

    pkg.name = appName;

    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

/**
 * Runs a shell command and returns a promise.
 */
function runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd,
            stdio: "inherit",
            shell: true,
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(`Command '${command} ${args.join(" ")}' failed with code ${code}`)
                );
            }
        });

        proc.on("error", reject);
    });
}

/**
 * Removes the .git directory from the template.
 */
function removeGitDirectory(projectDir: string): void {
    const gitDir = path.join(projectDir, ".git");
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true });
    }
}

/**
 * Initializes a new Bkper app from the template.
 *
 * @param name - The name of the new app (used as directory name and app id)
 */
export async function initApp(name: string): Promise<void> {
    // 1. Validate app name
    const validation = validateAppName(name);
    if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
    }

    // 2. Check if directory already exists
    const targetDir = path.resolve(process.cwd(), name);
    if (fs.existsSync(targetDir)) {
        console.error(
            `Error: Directory '${name}' already exists. Choose a different name or remove it first.`
        );
        process.exit(1);
    }

    console.log(`\nCreating Bkper app '${name}'...\n`);

    // 3. Download template
    try {
        await downloadTemplate(targetDir);
        console.log("  Downloaded template");
    } catch (err) {
        console.error("Error downloading template:", err instanceof Error ? err.message : err);
        // Clean up on failure
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        process.exit(1);
    }

    // 4. Remove .git directory from template
    removeGitDirectory(targetDir);

    // 5. Update bkperapp.yaml
    try {
        updateBkperAppYaml(targetDir, name);
        console.log("  Updated bkperapp.yaml");
    } catch (err) {
        console.error("Error updating bkperapp.yaml:", err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 6. Update package.json
    try {
        updatePackageJson(targetDir, name);
        console.log("  Updated package.json");
    } catch (err) {
        console.error("Error updating package.json:", err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 7. Sync global skills
    try {
        const result = await updateSkills();
        if (result.updated.length > 0) {
            console.log(`  Synced skills (${result.updated.join(", ")})`);
        } else if (result.skipped && result.commit) {
            console.log(`  Skills up to date (${result.commit.substring(0, 7)})`);
        }
    } catch (err) {
        // Skills sync is non-fatal, just warn
        console.log("  Warning: Could not sync skills:", err instanceof Error ? err.message : err);
    }

    // 8. Install dependencies
    console.log("  Installing dependencies...");
    try {
        await runCommand("bun", ["install"], targetDir);
        console.log("  Installed dependencies");
    } catch (err) {
        console.log('  Warning: Could not install dependencies. Run "bun install" manually.');
    }

    // 9. Initialize git repository
    try {
        await runCommand("git", ["init"], targetDir);
        console.log("  Initialized git repository");
    } catch (err) {
        console.log('  Warning: Could not initialize git repository. Run "git init" manually.');
    }

    // 10. Print success message
    console.log(`
Done! To get started:

  cd ${name}
  bun run dev
`);
}

// =============================================================================
// Secrets Functions
// =============================================================================

interface SecretsOptions {
    dev?: boolean;
}

/**
 * Prompts for secret value from stdin.
 * Reads from piped input if available, otherwise prompts interactively.
 *
 * @returns The secret value
 */
async function promptSecretValue(): Promise<string> {
    // Check if stdin is a TTY (interactive) or piped
    if (!process.stdin.isTTY) {
        // Read from piped input
        return new Promise((resolve, reject) => {
            let data = "";
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", (chunk) => {
                data += chunk;
            });
            process.stdin.on("end", () => {
                resolve(data.trim());
            });
            process.stdin.on("error", reject);
        });
    }

    // Interactive prompt
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question("Enter secret value: ", (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Sets a secret value for the app.
 *
 * @param name - Secret name
 * @param options - Options (dev environment)
 */
export async function secretsPut(name: string, options: SecretsOptions = {}): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Load app config
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

    // 3. Prompt for secret value
    const value = await promptSecretValue();
    if (!value) {
        console.error("Error: Secret value cannot be empty");
        process.exit(1);
    }

    // 4. Get OAuth token and create client
    const token = await getOAuthToken();
    const client = createPlatformClient(token);

    // 5. Call Platform API
    const env = options.dev ? "dev" : "prod";
    
    const { data, error } = await client.PUT("/api/apps/{appId}/secrets/{name}", {
        params: {
            path: { appId: config.id, name },
            query: { env },
        },
        body: { value },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    console.log(`Secret '${name}' set in ${env}`);
}

/**
 * Lists all secrets for the app.
 *
 * @param options - Options (dev environment)
 */
export async function secretsList(options: SecretsOptions = {}): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Load app config
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
    const env = options.dev ? "dev" : "prod";
    
    const { data, error } = await client.GET("/api/apps/{appId}/secrets", {
        params: {
            path: { appId: config.id },
            query: { env },
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    // 5. Display secrets
    if (data.secrets.length === 0) {
        console.log(`No secrets found in ${env}`);
        return;
    }

    console.log(`Secrets in ${env}:`);
    console.log(data.secrets.join(", "));
}

/**
 * Deletes a secret from the app.
 *
 * @param name - Secret name
 * @param options - Options (dev environment)
 */
export async function secretsDelete(name: string, options: SecretsOptions = {}): Promise<void> {
    // 1. Check if logged in
    if (!isLoggedIn()) {
        console.error("Error: You must be logged in. Run: bkper login");
        process.exit(1);
    }

    // 2. Load app config
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
    const env = options.dev ? "dev" : "prod";
    
    const { data, error } = await client.DELETE("/api/apps/{appId}/secrets/{name}", {
        params: {
            path: { appId: config.id, name },
            query: { env },
        },
    });

    if (error) {
        handleError(error);
    }

    if (!data) {
        console.error("Error: Unexpected empty response");
        process.exit(1);
    }

    console.log(`Secret '${name}' deleted from ${env}`);
}
