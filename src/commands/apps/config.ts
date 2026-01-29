import { App } from "bkper-js";
import fs from "fs";
import * as YAML from "yaml";
import type { ErrorResponse, DeploymentConfig } from "./types.js";

// =============================================================================
// App Config Loading
// =============================================================================

/**
 * Loads app configuration from bkper.json, bkper.yaml, bkperapp.json, or bkperapp.yaml in current directory.
 * Checks files in priority order: bkper.json → bkper.yaml → bkperapp.json → bkperapp.yaml
 *
 * @returns App configuration object
 * @throws Error if no config file is found
 */
export function loadAppConfig(): bkper.App {
    // Priority order: new filenames first, legacy filenames as fallback
    const configPaths = [
        "./bkper.json",
        "./bkper.yaml",
        "./bkperapp.json",    // Legacy
        "./bkperapp.yaml"     // Legacy
    ];

    for (const path of configPaths) {
        if (fs.existsSync(path)) {
            const content = fs.readFileSync(path, "utf8");
            return path.endsWith(".json") 
                ? JSON.parse(content) 
                : YAML.parse(content);
        }
    }

    throw new Error("bkper.yaml or bkper.json not found");
}

/**
 * Loads deployment configuration from bkper.yaml or bkperapp.yaml.
 * Checks in priority order: bkper.yaml → bkperapp.yaml
 *
 * @returns Deployment configuration or undefined if not configured
 */
export function loadDeploymentConfig(): DeploymentConfig | undefined {
    // Priority order: new filename first, legacy as fallback
    const yamlPaths = ["./bkper.yaml", "./bkperapp.yaml"];

    for (const path of yamlPaths) {
        if (fs.existsSync(path)) {
            const config = YAML.parse(fs.readFileSync(path, "utf8")) as bkper.App & { 
                deployment?: { 
                    web: { bundle: string; assets?: string };
                    events: { bundle: string };
                    services?: string[];
                };
            };
            if (config.deployment) {
                return {
                    web: config.deployment.web,
                    events: config.deployment.events,
                    services: config.deployment.services,
                };
            }
        }
    }
    return undefined;
}

/**
 * Loads README.md content if it exists.
 *
 * @returns README content or undefined
 */
export function loadReadme(): string | undefined {
    if (fs.existsSync("./README.md")) {
        return fs.readFileSync("./README.md", "utf8");
    }
    return undefined;
}

/**
 * Creates an App instance configured from bkper.yaml (or bkperapp.yaml) and environment variables.
 *
 * @returns Configured App instance
 */
export function createConfiguredApp(): App {
    const json = loadAppConfig();
    const app = new App(json);

    const readme = loadReadme();
    if (readme) {
        app.setReadme(readme);
    }

    return app;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Handles error response from Platform API
 */
export function handleError(error: ErrorResponse): never {
    console.error(`Error: ${error.error.message}`);
    if (error.error.details) {
        console.error("Details:", JSON.stringify(error.error.details, null, 2));
    }
    process.exit(1);
}
