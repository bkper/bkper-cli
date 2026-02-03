import { App } from 'bkper-js';
import fs from 'fs';
import * as YAML from 'yaml';
import type { ErrorResponse, DeploymentConfig, SourceDeploymentConfig } from './types.js';

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
        './bkper.json',
        './bkper.yaml',
        './bkperapp.json', // Legacy
        './bkperapp.yaml', // Legacy
    ];

    for (const path of configPaths) {
        if (fs.existsSync(path)) {
            const content = fs.readFileSync(path, 'utf8');
            return path.endsWith('.json') ? JSON.parse(content) : YAML.parse(content);
        }
    }

    throw new Error('bkper.yaml or bkper.json not found');
}

/**
 * Loads deployment configuration from bkper.yaml or bkperapp.yaml.
 * Checks in priority order: bkper.yaml → bkperapp.yaml
 *
 * @returns Deployment configuration or undefined if not configured
 */
export function loadDeploymentConfig(): DeploymentConfig | undefined {
    // Priority order: new filename first, legacy as fallback
    const yamlPaths = ['./bkper.yaml', './bkperapp.yaml'];

    for (const path of yamlPaths) {
        if (fs.existsSync(path)) {
            const config = YAML.parse(fs.readFileSync(path, 'utf8')) as bkper.App & {
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
 * Checks if deployment config uses new source-based format.
 * Source format: entry points end with .ts
 * Legacy format: paths are directories (no extension)
 *
 * @param deployment - The deployment configuration object to check
 * @returns true if the deployment uses source-based format, false otherwise
 */
export function isSourceConfig(deployment: unknown): boolean {
    if (!deployment || typeof deployment !== 'object') return false;
    const d = deployment as Record<string, unknown>;

    // Check if web.main or events.main ends with .ts
    const webMain = (d.web as Record<string, unknown> | undefined)?.main;
    const eventsMain = (d.events as Record<string, unknown> | undefined)?.main;

    return (
        (typeof webMain === 'string' && webMain.endsWith('.ts')) ||
        (typeof eventsMain === 'string' && eventsMain.endsWith('.ts'))
    );
}

/**
 * Loads source-based deployment configuration from bkper.yaml.
 * Maps snake_case YAML keys to camelCase TypeScript properties.
 * Checks in priority order: bkper.yaml → bkperapp.yaml
 *
 * @returns Source deployment configuration or undefined if not configured
 */
export function loadSourceDeploymentConfig(): SourceDeploymentConfig | undefined {
    const yamlPaths = ['./bkper.yaml', './bkperapp.yaml'];

    for (const path of yamlPaths) {
        if (fs.existsSync(path)) {
            const config = YAML.parse(fs.readFileSync(path, 'utf8')) as {
                deployment?: {
                    web?: { main: string; client?: string };
                    events?: { main: string };
                    services?: string[];
                    secrets?: string[];
                    compatibility_date?: string;
                };
            };
            if (config.deployment && isSourceConfig(config.deployment)) {
                return {
                    web: config.deployment.web,
                    events: config.deployment.events,
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
export function handleError(error: ErrorResponse | unknown): never {
    // Handle unexpected error shapes (e.g., network errors, non-JSON responses)
    if (
        !error ||
        typeof error !== 'object' ||
        !('error' in error) ||
        !(error as ErrorResponse).error?.message
    ) {
        console.error('Error deploying app:', error);
        process.exit(1);
    }

    const typedError = error as ErrorResponse;
    console.error(`Error: ${typedError.error.message}`);
    if (typedError.error.details) {
        console.error('Details:', JSON.stringify(typedError.error.details, null, 2));
    }
    process.exit(1);
}
