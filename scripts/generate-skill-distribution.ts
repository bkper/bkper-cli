import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSkillDistributionAssets } from '../src/agent/skill-distribution.ts';

interface PackageJson {
    version: string;
    repositoryUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }

    return value;
}

function parseRepositoryUrl(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (isRecord(value)) {
        return requireString(value.url, 'package repository url');
    }

    throw new Error('package repository must be a string or object with url');
}

async function readPackageJson(rootDir: string): Promise<PackageJson> {
    const parsed: unknown = JSON.parse(
        await readFile(path.join(rootDir, 'package.json'), 'utf8')
    );

    if (!isRecord(parsed)) {
        throw new Error('package.json must contain an object');
    }

    return {
        version: requireString(parsed.version, 'package version'),
        repositoryUrl: parseRepositoryUrl(parsed.repository),
    };
}

async function main(): Promise<void> {
    const rootDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
    );
    const packageJson = await readPackageJson(rootDir);
    const result = await createSkillDistributionAssets({
        rootDir,
        outputDir: path.join(rootDir, 'dist', 'agent-skills'),
        packageVersion: packageJson.version,
        repositoryUrl: packageJson.repositoryUrl,
    });

    console.log(`Wrote ${path.relative(rootDir, result.archivePath)}`);
    console.log(`Wrote ${path.relative(rootDir, result.latestMetadataPath)}`);
    console.log(`Wrote ${path.relative(rootDir, result.versionedMetadataPath)}`);
    console.log(result.entry.digest);
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
