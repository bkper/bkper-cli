import { App } from "bkper-js";
import fs from "fs";
import * as YAML from "yaml";
import type { ErrorResponse } from "./types.js";

// =============================================================================
// App Config Loading
// =============================================================================

/**
 * Loads app configuration from bkperapp.json or bkperapp.yaml in current directory.
 *
 * @returns App configuration object
 * @throws Error if no config file is found
 */
export function loadAppConfig(): bkper.App {
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
export function loadReadme(): string | undefined {
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
