import type { components } from "../../platform/types.js";

// =============================================================================
// OpenAPI Types
// =============================================================================

export type DeployResult = components["schemas"]["DeployResult"];
export type UndeployResult = components["schemas"]["UndeployResult"];
export type AppStatus = components["schemas"]["AppStatus"];
export type ErrorResponse = components["schemas"]["ErrorResponse"];

// =============================================================================
// Command Options
// =============================================================================

export interface DeployOptions {
    dev?: boolean;
    events?: boolean;
    sync?: boolean;
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
    action: "created" | "updated";
}

// =============================================================================
// Internal Types
// =============================================================================

export type HandlerType = "web" | "events";
export type Environment = "dev" | "prod";
