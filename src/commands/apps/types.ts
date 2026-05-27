import type { components } from '../../platform/types.js';

// =============================================================================
// OpenAPI Types
// =============================================================================

export type DeployResult = components['schemas']['DeployResult'];
export type UndeployResult = components['schemas']['UndeployResult'];
export type AppStatus = components['schemas']['AppStatus'];
export type ErrorResponse = components['schemas']['ErrorResponse'];
export type LogsResponse = components['schemas']['LogsResponse'];
export type LogEntry = components['schemas']['LogEntry'];
export type LogsMeta = components['schemas']['LogsMeta'];
export type LogOutcome = components['schemas']['LogOutcome'];

// =============================================================================
// Command Options
// =============================================================================

export interface DeployOptions {
    preview?: boolean;
    deleteData?: boolean;
    force?: boolean;
}

export interface SecretsOptions {
    preview?: boolean;
}

export interface LogsOptions {
    since?: string;
    until?: string;
    last?: number;
    preview?: boolean;
    web?: boolean;
    events?: boolean;
    outcome?: LogOutcome;
    statusCode?: number;
}

export type LogsOutputMode = 'pretty' | 'json';

// =============================================================================
// Result Types
// =============================================================================

export interface SyncResult {
    id: string;
    action: 'created' | 'updated';
}

// =============================================================================
// Internal Types
// =============================================================================

export type HandlerType = 'web' | 'events';
export type Environment = 'preview' | 'production';

// =============================================================================
// Source-based Deployment Configuration
// =============================================================================

/**
 * Source-based deployment configuration from bkper.yaml.
 */
export interface SourceDeploymentConfig {
    server: string; // TypeScript Worker entry point (.ts file)
    client?: string; // Vite/static client root
    services?: string[]; // List of services (e.g., ['KV'])
    secrets?: string[]; // List of secret names (e.g., ['API_KEY'])
    compatibilityDate?: string; // camelCase in TS, maps from compatibility_date in YAML
}
