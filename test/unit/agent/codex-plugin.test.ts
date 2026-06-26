import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '../helpers/test-setup.js';

interface PluginManifest {
    name: string;
    version: string;
    description: string;
    skills?: string;
    mcpServers?: string;
    apps?: string;
    hooks?: string;
    interface?: {
        displayName?: string;
        shortDescription?: string;
        longDescription?: string;
        developerName?: string;
        category?: string;
        capabilities?: string[];
        websiteURL?: string;
        privacyPolicyURL?: string;
        termsOfServiceURL?: string;
        defaultPrompt?: string[];
        brandColor?: string;
        composerIcon?: string;
        logo?: string;
        screenshots?: string[];
    };
}

interface Marketplace {
    name: string;
    interface?: {
        displayName?: string;
    };
    plugins: MarketplacePlugin[];
}

interface MarketplacePlugin {
    name: string;
    source: string | {
        source: string;
        path: string;
    };
    policy: {
        installation: string;
        authentication: string;
    };
    category: string;
}

interface PackageJson {
    version: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new Error('Expected string array');
    }
    return value;
}

function parsePluginManifest(value: unknown): PluginManifest {
    if (!isRecord(value)) {
        throw new Error('Plugin manifest must be an object');
    }

    const interfaceValue = value.interface;
    let interfaceMetadata: PluginManifest['interface'];
    if (interfaceValue !== undefined) {
        if (!isRecord(interfaceValue)) {
            throw new Error('Plugin interface metadata must be an object');
        }
        interfaceMetadata = {
            displayName: parseOptionalString(interfaceValue.displayName),
            shortDescription: parseOptionalString(interfaceValue.shortDescription),
            longDescription: parseOptionalString(interfaceValue.longDescription),
            developerName: parseOptionalString(interfaceValue.developerName),
            category: parseOptionalString(interfaceValue.category),
            capabilities: parseStringArray(interfaceValue.capabilities),
            websiteURL: parseOptionalString(interfaceValue.websiteURL),
            privacyPolicyURL: parseOptionalString(interfaceValue.privacyPolicyURL),
            termsOfServiceURL: parseOptionalString(interfaceValue.termsOfServiceURL),
            defaultPrompt: parseStringArray(interfaceValue.defaultPrompt),
            brandColor: parseOptionalString(interfaceValue.brandColor),
            composerIcon: parseOptionalString(interfaceValue.composerIcon),
            logo: parseOptionalString(interfaceValue.logo),
            screenshots: parseStringArray(interfaceValue.screenshots),
        };
    }

    return {
        name: parseRequiredString(value.name, 'name'),
        version: parseRequiredString(value.version, 'version'),
        description: parseRequiredString(value.description, 'description'),
        skills: parseOptionalString(value.skills),
        mcpServers: parseOptionalString(value.mcpServers),
        apps: parseOptionalString(value.apps),
        hooks: parseOptionalString(value.hooks),
        interface: interfaceMetadata,
    };
}

function parseMarketplace(value: unknown): Marketplace {
    if (!isRecord(value)) {
        throw new Error('Marketplace must be an object');
    }
    if (!Array.isArray(value.plugins)) {
        throw new Error('Marketplace plugins must be an array');
    }

    const interfaceValue = value.interface;
    let marketplaceInterface: Marketplace['interface'];
    if (interfaceValue !== undefined) {
        if (!isRecord(interfaceValue)) {
            throw new Error('Marketplace interface must be an object');
        }
        marketplaceInterface = {
            displayName: parseOptionalString(interfaceValue.displayName),
        };
    }

    return {
        name: parseRequiredString(value.name, 'name'),
        interface: marketplaceInterface,
        plugins: value.plugins.map(parseMarketplacePlugin),
    };
}

function parseMarketplacePlugin(value: unknown): MarketplacePlugin {
    if (!isRecord(value)) {
        throw new Error('Marketplace plugin must be an object');
    }
    if (!isRecord(value.policy)) {
        throw new Error('Marketplace plugin policy must be an object');
    }

    const source = parseMarketplaceSource(value.source);

    return {
        name: parseRequiredString(value.name, 'name'),
        source,
        policy: {
            installation: parseRequiredString(value.policy.installation, 'installation'),
            authentication: parseRequiredString(value.policy.authentication, 'authentication'),
        },
        category: parseRequiredString(value.category, 'category'),
    };
}

function parseMarketplaceSource(value: unknown): MarketplacePlugin['source'] {
    if (typeof value === 'string') {
        return value;
    }
    if (!isRecord(value)) {
        throw new Error('Marketplace source must be a string or object');
    }
    return {
        source: parseRequiredString(value.source, 'source'),
        path: parseRequiredString(value.path, 'path'),
    };
}

function parseRequiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Expected required string field: ${field}`);
    }
    return value;
}

function parseOptionalString(value: unknown): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error('Expected optional string field');
    }
    return value;
}

async function readJsonFile<T>(filePath: string, parse: (value: unknown) => T): Promise<T> {
    return parse(JSON.parse(await readFile(filePath, 'utf8')));
}

function expectManifestPath(pluginRoot: string, manifestPath: string | undefined): void {
    expect(manifestPath).to.be.a('string');
    if (!manifestPath) {
        return;
    }
    expect(manifestPath.startsWith('./')).to.equal(true);
    expect(existsSync(path.join(pluginRoot, manifestPath))).to.equal(true);
}

describe('Codex plugin package', function () {
    const pluginRoot = path.resolve('.');
    const manifestPath = path.resolve('.codex-plugin/plugin.json');
    const marketplacePath = path.resolve('.agents/plugins/marketplace.json');
    const packageJsonPath = path.resolve('package.json');
    const canonicalSkillPath = path.resolve('skill/SKILL.md');
    const duplicatedPluginRoot = path.resolve('plugins/bkper-cli');

    it('should expose the repository plugin through the Codex repo marketplace', async function () {
        const marketplace = await readJsonFile(marketplacePath, parseMarketplace);
        const plugin = marketplace.plugins.find(entry => entry.name === 'bkper-cli');

        expect(marketplace.name).to.equal('bkper');
        expect(marketplace.interface?.displayName).to.equal('Bkper Plugins');
        expect(plugin).not.to.equal(undefined);
        if (!plugin) {
            return;
        }
        expect(plugin.source).to.deep.equal({
            source: 'local',
            path: './',
        });
        expect(plugin.policy).to.deep.equal({
            installation: 'AVAILABLE',
            authentication: 'ON_INSTALL',
        });
        expect(plugin.category).to.equal('Productivity');
        expect(existsSync(manifestPath)).to.equal(true);
    });

    it('should point the Codex plugin manifest at canonical skill content', async function () {
        const manifest = await readJsonFile(manifestPath, parsePluginManifest);
        const packageJson = await readJsonFile(packageJsonPath, (value: unknown): PackageJson => {
            if (!isRecord(value)) {
                throw new Error('package.json must be an object');
            }
            return {version: parseRequiredString(value.version, 'version')};
        });

        expect(manifest.name).to.equal('bkper-cli');
        expect(manifest.version).to.equal(packageJson.version);
        expect(manifest.description).not.to.equal('');
        expect(manifest.skills).to.equal('./skill/');
        expectManifestPath(pluginRoot, manifest.skills);
        expect(existsSync(canonicalSkillPath)).to.equal(true);
        expect(existsSync(duplicatedPluginRoot)).to.equal(false);
        expect(manifest.mcpServers).to.equal(undefined);
        expect(manifest.apps).to.equal(undefined);
        expect(manifest.hooks).to.equal(undefined);
        expect(manifest.interface?.displayName).to.equal('Bkper CLI');
        expect(manifest.interface?.developerName).to.equal('Bkper');
        expect(manifest.interface?.capabilities).to.include.members(['Read', 'Write']);
        expect(manifest.interface?.websiteURL).to.equal('https://bkper.com');
        expect(manifest.interface?.privacyPolicyURL).to.equal('https://bkper.com/privacy');
        expect(manifest.interface?.termsOfServiceURL).to.equal('https://bkper.com/terms');
        expect(manifest.interface?.defaultPrompt?.length).to.be.greaterThan(0);
        expectManifestPath(pluginRoot, manifest.interface?.composerIcon);
        expectManifestPath(pluginRoot, manifest.interface?.logo);
        for (const screenshot of manifest.interface?.screenshots ?? []) {
            expectManifestPath(pluginRoot, screenshot);
        }
    });

    it('should keep only plugin.json in the Codex plugin metadata directory', async function () {
        const codexMetadataEntries = await readdir(path.resolve('.codex-plugin'));

        expect(codexMetadataEntries).to.deep.equal(['plugin.json']);
    });
});
