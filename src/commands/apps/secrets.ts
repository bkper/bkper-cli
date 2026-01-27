import * as readline from "readline";
import { getOAuthToken, isLoggedIn } from "../../auth/local-auth-service.js";
import { createPlatformClient } from "../../platform/client.js";
import { handleError, loadAppConfig } from "./config.js";
import type { Environment, SecretsOptions } from "./types.js";

// =============================================================================
// Helper Functions
// =============================================================================

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

// =============================================================================
// Public API
// =============================================================================

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
    const env: Environment = options.dev ? "dev" : "prod";

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
    const env: Environment = options.dev ? "dev" : "prod";

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
    const env: Environment = options.dev ? "dev" : "prod";

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
