import type { components } from '../../platform/types.js';

// =============================================================================
// OpenAPI Types
// =============================================================================

export type DeployResult = components['schemas']['DeployResult'];
export type UndeployResult = components['schemas']['UndeployResult'];
export type AppStatus = components['schemas']['AppStatus'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

// =============================================================================
// Command Options
// =============================================================================

export interface DeployOptions {
    dev?: boolean;
    events?: boolean;
    deleteData?: boolean;
    force?: boolean;
}

export interface SecretsOptions {
    dev?: boolean;
}

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
export type Environment = 'dev' | 'prod';

// =============================================================================
// Deployment Configuration
// =============================================================================

/**
 * Handler-specific deployment configuration (legacy bundle-based format)
 */
export interface HandlerDeploymentConfig {
    bundle: string; // Path to worker bundle directory
    assets?: string; // Path to static assets directory (web only)
}

/**
 * Deployment configuration from bkperapp.yaml (legacy bundle-based format)
 */
export interface DeploymentConfig {
    web: HandlerDeploymentConfig;
    events: HandlerDeploymentConfig;
    services?: string[]; // List of services (e.g., ['KV'])
}

// =============================================================================
// Source-based Deployment Configuration (new format)
// =============================================================================

/**
 * Source-based handler configuration using TypeScript entry points
 */
export interface SourceHandlerConfig {
    main: string; // TypeScript entry point (.ts file)
    client?: string; // Vite project root (web only)
}

/**
 * Source-based deployment configuration from bkper.yaml
 * Uses TypeScript entry points instead of pre-built bundles
 */
export interface SourceDeploymentConfig {
    web?: SourceHandlerConfig;
    events?: SourceHandlerConfig;
    services?: string[]; // List of services (e.g., ['KV'])
    secrets?: string[]; // List of secret names (e.g., ['API_KEY'])
    compatibilityDate?: string; // camelCase in TS, maps from compatibility_date in YAML
}
