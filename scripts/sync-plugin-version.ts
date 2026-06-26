import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type JsonRecord = Record<string, unknown>;

interface SyncResult {
    pluginManifest: JsonRecord;
    marketplaceManifest: JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }
    return value;
}

function removeVersion(record: JsonRecord): JsonRecord {
    const result: JsonRecord = {};

    for (const key in record) {
        if (
            Object.prototype.hasOwnProperty.call(record, key) &&
            key !== 'version'
        ) {
            result[key] = record[key];
        }
    }

    return result;
}

function normalizeMarketplacePluginEntry(
    entry: unknown,
    pluginName: string
): unknown {
    if (!isRecord(entry)) {
        return entry;
    }

    const isMatchingPlugin =
        entry.name === pluginName || entry.source === './skill';

    if (!isMatchingPlugin) {
        return entry;
    }

    return removeVersion(entry);
}

export function syncClaudePluginVersions(
    packageVersion: string,
    pluginManifest: JsonRecord,
    marketplaceManifest: JsonRecord
): SyncResult {
    const pluginName = requireString(pluginManifest.name, 'plugin manifest name');
    const plugins = marketplaceManifest.plugins;

    if (!Array.isArray(plugins)) {
        throw new Error('marketplace manifest plugins must be an array');
    }

    return {
        pluginManifest: {
            ...pluginManifest,
            version: packageVersion,
        },
        marketplaceManifest: {
            ...marketplaceManifest,
            plugins: plugins.map(entry =>
                normalizeMarketplacePluginEntry(entry, pluginName)
            ),
        },
    };
}

async function readJsonRecord(filePath: string): Promise<JsonRecord> {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!isRecord(parsed)) {
        throw new Error(`${filePath} must contain a JSON object`);
    }
    return parsed;
}

function formatJson(record: JsonRecord): string {
    return `${JSON.stringify(record, null, 4)}\n`;
}

async function main(): Promise<void> {
    const rootDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
    );
    const packageJsonPath = path.join(rootDir, 'package.json');
    const pluginManifestPath = path.join(
        rootDir,
        'skill',
        '.claude-plugin',
        'plugin.json'
    );
    const marketplaceManifestPath = path.join(
        rootDir,
        '.claude-plugin',
        'marketplace.json'
    );

    const packageJson = await readJsonRecord(packageJsonPath);
    const packageVersion = requireString(packageJson.version, 'package version');
    const pluginManifest = await readJsonRecord(pluginManifestPath);
    const marketplaceManifest = await readJsonRecord(marketplaceManifestPath);
    const result = syncClaudePluginVersions(
        packageVersion,
        pluginManifest,
        marketplaceManifest
    );

    await writeFile(
        pluginManifestPath,
        formatJson(result.pluginManifest),
        'utf8'
    );
    await writeFile(
        marketplaceManifestPath,
        formatJson(result.marketplaceManifest),
        'utf8'
    );
}

function isDirectInvocation(): boolean {
    const entrypoint = process.argv[1];
    return entrypoint
        ? import.meta.url === pathToFileURL(path.resolve(entrypoint)).href
        : false;
}

if (isDirectInvocation()) {
    void main().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
