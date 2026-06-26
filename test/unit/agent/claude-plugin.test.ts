import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '../helpers/test-setup.js';

interface PackageJson {
    version: string;
    repository: string;
    license: string;
}

interface PluginManifest {
    name: string;
    description: string;
    version: string;
    author: {
        name: string;
        email?: string;
    };
    homepage: string;
    repository: string;
    license: string;
    keywords: string[];
    skills: string | string[];
}

interface MarketplaceManifest {
    name: string;
    owner: {
        name: string;
        email?: string;
    };
    description?: string;
    metadata?: {
        description?: string;
    };
    plugins: Array<{
        name: string;
        source: string;
        description: string;
        version?: string;
    }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonRecord(filePath: string): Promise<Record<string, unknown>> {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!isRecord(parsed)) {
        throw new Error(`${filePath} must contain a JSON object`);
    }
    return parsed;
}

async function readPackageJson(filePath: string): Promise<PackageJson> {
    const manifest = await readJsonRecord(filePath);

    if (
        typeof manifest.version !== 'string' ||
        typeof manifest.repository !== 'string' ||
        typeof manifest.license !== 'string'
    ) {
        throw new Error(`${filePath} is missing required package metadata`);
    }

    return {
        version: manifest.version,
        repository: manifest.repository,
        license: manifest.license,
    };
}

function isStringOrStringArray(value: unknown): value is string | string[] {
    return (
        typeof value === 'string' ||
        (Array.isArray(value) && value.every(item => typeof item === 'string'))
    );
}

function toPluginManifest(manifest: Record<string, unknown>): PluginManifest {
    if (
        typeof manifest.name !== 'string' ||
        typeof manifest.description !== 'string' ||
        typeof manifest.version !== 'string' ||
        !isRecord(manifest.author) ||
        typeof manifest.author.name !== 'string' ||
        typeof manifest.homepage !== 'string' ||
        typeof manifest.repository !== 'string' ||
        typeof manifest.license !== 'string' ||
        !Array.isArray(manifest.keywords) ||
        !manifest.keywords.every(keyword => typeof keyword === 'string') ||
        !isStringOrStringArray(manifest.skills)
    ) {
        throw new Error('Invalid Claude Code plugin manifest shape');
    }

    return manifest as unknown as PluginManifest;
}

function toMarketplaceManifest(
    manifest: Record<string, unknown>
): MarketplaceManifest {
    if (
        typeof manifest.name !== 'string' ||
        !isRecord(manifest.owner) ||
        typeof manifest.owner.name !== 'string' ||
        (manifest.description !== undefined &&
            typeof manifest.description !== 'string') ||
        (manifest.metadata !== undefined && !isRecord(manifest.metadata)) ||
        !Array.isArray(manifest.plugins)
    ) {
        throw new Error('Invalid Claude Code marketplace manifest shape');
    }

    for (const plugin of manifest.plugins) {
        if (
            !isRecord(plugin) ||
            typeof plugin.name !== 'string' ||
            typeof plugin.source !== 'string' ||
            typeof plugin.description !== 'string' ||
            (plugin.version !== undefined && typeof plugin.version !== 'string')
        ) {
            throw new Error('Invalid Claude Code marketplace plugin entry shape');
        }
    }

    if (
        isRecord(manifest.metadata) &&
        manifest.metadata.description !== undefined &&
        typeof manifest.metadata.description !== 'string'
    ) {
        throw new Error('Invalid Claude Code marketplace metadata shape');
    }

    return manifest as unknown as MarketplaceManifest;
}

describe('Claude Code plugin publishing metadata', function () {
    const packageJsonPath = path.resolve('package.json');
    const pluginManifestPath = path.resolve('.claude-plugin/plugin.json');
    const legacySkillPluginManifestPath = path.resolve(
        'skill/.claude-plugin/plugin.json'
    );
    const marketplaceManifestPath = path.resolve(
        '.claude-plugin/marketplace.json'
    );
    const canonicalSkillPath = path.resolve('skill/SKILL.md');

    async function readPluginManifest(): Promise<PluginManifest> {
        return toPluginManifest(await readJsonRecord(pluginManifestPath));
    }

    async function readMarketplaceManifest(): Promise<MarketplaceManifest> {
        return toMarketplaceManifest(await readJsonRecord(marketplaceManifestPath));
    }

    it('should expose the maintained skill as a Claude Code plugin', async function () {
        const packageJson = await readPackageJson(packageJsonPath);
        const manifest = await readPluginManifest();

        expect(manifest.name).to.equal('bkper-cli');
        expect(manifest.description).to.be.a('string').and.not.equal('');
        expect(manifest.version).to.equal(packageJson.version);
        expect(manifest.repository).to.equal(packageJson.repository);
        expect(manifest.license).to.equal(packageJson.license);
        expect(manifest.author.name).to.equal('Bkper');
        expect(manifest.homepage).to.equal('https://bkper.com/docs');
        expect(manifest.skills).to.equal('./skill/');
        expect(existsSync(canonicalSkillPath)).to.equal(true);
        expect(existsSync(legacySkillPluginManifestPath)).to.equal(false);
        expect(manifest.keywords).to.include.members([
            'bkper',
            'accounting',
            'finance',
            'cli',
        ]);
    });

    it('should publish a marketplace entry for the repository plugin root', async function () {
        const pluginManifest = await readPluginManifest();
        const marketplace = await readMarketplaceManifest();

        expect(marketplace.name).to.equal('bkper');
        expect(marketplace.owner.name).to.equal('Bkper');
        expect(marketplace.description).to.equal(undefined);
        expect(marketplace.metadata?.description).to.equal(
            'Claude Code plugins for Bkper workflows.'
        );
        expect(marketplace.plugins).to.have.lengthOf(1);

        const [plugin] = marketplace.plugins;
        expect(plugin.name).to.equal(pluginManifest.name);
        expect(plugin.source).to.equal('./');
        expect(plugin.description).to.equal(pluginManifest.description);
        expect(plugin).not.to.have.property('version');
    });
});
