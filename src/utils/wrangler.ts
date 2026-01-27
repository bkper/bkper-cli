import fs from "fs";
import path from "path";

// =============================================================================
// Types
// =============================================================================

export interface WranglerBinding {
    binding: string;
}

export interface WranglerConfig {
    kv_namespaces?: WranglerBinding[];
    r2_buckets?: WranglerBinding[];
    d1_databases?: WranglerBinding[];
    compatibility_date?: string;
    compatibility_flags?: string[];
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Finds the wrangler.jsonc config file based on deploy type.
 * Supports both monorepo (bkper-app-template) and simple project structures.
 *
 * @param type - The deploy type ('web' or 'events')
 * @returns Path to wrangler.jsonc if found, null otherwise
 */
export function findWranglerConfig(type: "web" | "events"): string | null {
    // Monorepo candidates based on type
    const monorepoEventsCandidates = [
        "./packages/events/wrangler.jsonc",
        "./packages/events/wrangler.json",
    ];

    const monorepoWebCandidates = [
        "./packages/web/server/wrangler.jsonc",
        "./packages/web/server/wrangler.json",
    ];

    // Simple project candidates (fallback)
    const simpleCandidates = ["./wrangler.jsonc", "./wrangler.json"];

    // Check monorepo first based on type, then fall back to simple
    const candidates =
        type === "events"
            ? [...monorepoEventsCandidates, ...simpleCandidates]
            : [...monorepoWebCandidates, ...simpleCandidates];

    for (const candidate of candidates) {
        const fullPath = path.resolve(process.cwd(), candidate);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return null;
}

/**
 * Strips JSON comments (single-line // and multi-line /* *\/) from a string.
 * This allows parsing JSONC (JSON with Comments) files.
 *
 * @param jsonc - The JSONC string to strip comments from
 * @returns The JSON string without comments
 */
function stripJsonComments(jsonc: string): string {
    let result = "";
    let i = 0;
    let inString = false;
    let stringChar = "";

    while (i < jsonc.length) {
        const char = jsonc[i];
        const nextChar = jsonc[i + 1];

        // Handle string boundaries
        if ((char === '"' || char === "'") && (i === 0 || jsonc[i - 1] !== "\\")) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            result += char;
            i++;
            continue;
        }

        // Skip comments only when not in a string
        if (!inString) {
            // Single-line comment
            if (char === "/" && nextChar === "/") {
                // Skip until end of line
                while (i < jsonc.length && jsonc[i] !== "\n") {
                    i++;
                }
                continue;
            }

            // Multi-line comment
            if (char === "/" && nextChar === "*") {
                i += 2; // Skip /*
                while (i < jsonc.length - 1 && !(jsonc[i] === "*" && jsonc[i + 1] === "/")) {
                    i++;
                }
                i += 2; // Skip */
                continue;
            }
        }

        result += char;
        i++;
    }

    return result;
}

/**
 * Parses a wrangler.jsonc config file and extracts relevant bindings.
 *
 * @param configPath - Path to the wrangler.jsonc file
 * @returns Parsed WranglerConfig with bindings
 * @throws Error if file cannot be read or parsed
 */
export function parseWranglerConfig(configPath: string): WranglerConfig {
    const content = fs.readFileSync(configPath, "utf8");
    const strippedContent = stripJsonComments(content);
    const parsed = JSON.parse(strippedContent);

    // Extract only the binding names (not IDs) - Platform auto-provisions resources
    const config: WranglerConfig = {};

    if (parsed.kv_namespaces && Array.isArray(parsed.kv_namespaces)) {
        config.kv_namespaces = parsed.kv_namespaces.map((ns: { binding: string }) => ({
            binding: ns.binding,
        }));
    }

    if (parsed.r2_buckets && Array.isArray(parsed.r2_buckets)) {
        config.r2_buckets = parsed.r2_buckets.map((bucket: { binding: string }) => ({
            binding: bucket.binding,
        }));
    }

    if (parsed.d1_databases && Array.isArray(parsed.d1_databases)) {
        config.d1_databases = parsed.d1_databases.map((db: { binding: string }) => ({
            binding: db.binding,
        }));
    }

    if (parsed.compatibility_date) {
        config.compatibility_date = parsed.compatibility_date;
    }

    if (parsed.compatibility_flags && Array.isArray(parsed.compatibility_flags)) {
        config.compatibility_flags = parsed.compatibility_flags;
    }

    return config;
}

/**
 * Extracts bindings from wrangler config for the Platform API.
 * Returns only binding names as an object suitable for API transmission.
 *
 * @param config - Parsed WranglerConfig
 * @returns Object with binding arrays or undefined if no bindings
 */
export function extractBindingsForApi(
    config: WranglerConfig
): { kv?: string[]; r2?: string[]; d1?: string[] } | undefined {
    const bindings: { kv?: string[]; r2?: string[]; d1?: string[] } = {};

    if (config.kv_namespaces && config.kv_namespaces.length > 0) {
        bindings.kv = config.kv_namespaces.map((ns) => ns.binding);
    }

    if (config.r2_buckets && config.r2_buckets.length > 0) {
        bindings.r2 = config.r2_buckets.map((bucket) => bucket.binding);
    }

    if (config.d1_databases && config.d1_databases.length > 0) {
        bindings.d1 = config.d1_databases.map((db) => db.binding);
    }

    // Return undefined if no bindings found
    if (Object.keys(bindings).length === 0) {
        return undefined;
    }

    return bindings;
}
