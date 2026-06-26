import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type JsonRecord = Record<string, unknown>;

interface SyncResult {
    claudePluginManifest: JsonRecord;
    claudeMarketplaceManifest: JsonRecord;
    codexPluginManifest: JsonRecord;
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
        entry.name === pluginName ||
        entry.source === './' ||
        entry.source === './skill';

    if (!isMatchingPlugin) {
        return entry;
    }

    return removeVersion(entry);
}

export function syncPluginVersions(
    packageVersion: string,
    claudePluginManifest: JsonRecord,
    claudeMarketplaceManifest: JsonRecord,
    codexPluginManifest: JsonRecord
): SyncResult {
    const pluginName = requireString(
        claudePluginManifest.name,
        'Claude plugin manifest name'
    );
    const codexPluginName = requireString(
        codexPluginManifest.name,
        'Codex plugin manifest name'
    );
    const plugins = claudeMarketplaceManifest.plugins;

    if (codexPluginName !== pluginName) {
        throw new Error('Claude and Codex plugin names must match');
    }

    if (!Array.isArray(plugins)) {
        throw new Error('Claude marketplace manifest plugins must be an array');
    }

    return {
        claudePluginManifest: {
            ...claudePluginManifest,
            version: packageVersion,
        },
        claudeMarketplaceManifest: {
            ...claudeMarketplaceManifest,
            plugins: plugins.map(entry =>
                normalizeMarketplacePluginEntry(entry, pluginName)
            ),
        },
        codexPluginManifest: {
            ...codexPluginManifest,
            version: packageVersion,
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
    const claudePluginManifestPath = path.join(
        rootDir,
        '.claude-plugin',
        'plugin.json'
    );
    const claudeMarketplaceManifestPath = path.join(
        rootDir,
        '.claude-plugin',
        'marketplace.json'
    );
    const codexPluginManifestPath = path.join(
        rootDir,
        '.codex-plugin',
        'plugin.json'
    );

    const packageJson = await readJsonRecord(packageJsonPath);
    const packageVersion = requireString(packageJson.version, 'package version');
    const claudePluginManifest = await readJsonRecord(claudePluginManifestPath);
    const claudeMarketplaceManifest = await readJsonRecord(
        claudeMarketplaceManifestPath
    );
    const codexPluginManifest = await readJsonRecord(codexPluginManifestPath);
    const result = syncPluginVersions(
        packageVersion,
        claudePluginManifest,
        claudeMarketplaceManifest,
        codexPluginManifest
    );

    await writeFile(
        claudePluginManifestPath,
        formatJson(result.claudePluginManifest),
        'utf8'
    );
    await writeFile(
        claudeMarketplaceManifestPath,
        formatJson(result.claudeMarketplaceManifest),
        'utf8'
    );
    await writeFile(
        codexPluginManifestPath,
        formatJson(result.codexPluginManifest),
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
