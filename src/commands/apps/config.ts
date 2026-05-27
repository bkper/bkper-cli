import { App } from 'bkper-js';
import fs from 'fs';
import * as YAML from 'yaml';
import { getErrorMessage } from '../../auth/auth-errors.js';
import type { ErrorResponse, SourceDeploymentConfig } from './types.js';

// =============================================================================
// App Config Loading
// =============================================================================

/**
 * Loads app configuration from bkper.json or bkper.yaml in current directory.
 * Checks files in priority order: bkper.json → bkper.yaml
 *
 * @returns App configuration object
 * @throws Error if no config file is found
 */
export function loadAppConfig(): bkper.App {
    const configPaths = ['./bkper.json', './bkper.yaml'];

    for (const path of configPaths) {
        if (fs.existsSync(path)) {
            const content = fs.readFileSync(path, 'utf8');
            return path.endsWith('.json') ? JSON.parse(content) : YAML.parse(content);
        }
    }

    throw new Error('bkper.yaml or bkper.json not found');
}

/**
 * Checks if deployment config uses new source-based format.
 * Source format: deployment.server ends with .ts
 *
 * @param deployment - The deployment configuration object to check
 * @returns true if the deployment uses source-based format, false otherwise
 */
export function isSourceConfig(deployment: unknown): boolean {
    if (!deployment || typeof deployment !== 'object') return false;
    const d = deployment as Record<string, unknown>;

    const server = d.server;

    return typeof server === 'string' && server.endsWith('.ts');
}

/**
 * Loads source-based deployment configuration from bkper.yaml.
 * Maps snake_case YAML keys to camelCase TypeScript properties.
 *
 * @returns Source deployment configuration or undefined if not configured
 */
export function loadSourceDeploymentConfig(): SourceDeploymentConfig | undefined {
    const yamlPaths = ['./bkper.yaml'];

    for (const path of yamlPaths) {
        if (fs.existsSync(path)) {
            const config = YAML.parse(fs.readFileSync(path, 'utf8')) as {
                deployment?: {
                    server?: string;
                    client?: string;
                    services?: string[];
                    secrets?: string[];
                    compatibility_date?: string;
                };
            };
            if (config.deployment && isSourceConfig(config.deployment)) {
                if (!config.deployment.server) {
                    return undefined;
                }
                return {
                    server: config.deployment.server,
                    client: config.deployment.client,
                    services: config.deployment.services,
                    secrets: config.deployment.secrets,
                    // Map snake_case to camelCase
                    compatibilityDate: config.deployment.compatibility_date,
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
    if (fs.existsSync('./README.md')) {
        return fs.readFileSync('./README.md', 'utf8');
    }
    return undefined;
}

/**
 * Creates an App instance configured from bkper.yaml and environment variables.
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
export function handleError(error: ErrorResponse | unknown): never {
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exit(1);
}
