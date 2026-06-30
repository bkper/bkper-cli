import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { create as createTar } from 'tar';
import YAML from 'yaml';

export const SKILL_ARCHIVE_TYPE = 'archive';
export const LATEST_SKILL_METADATA_FILE_NAME = 'bkper-cli-skill.json';

interface SkillFrontmatter {
    name: string;
    description: string;
}

export interface SkillDiscoveryEntry extends SkillFrontmatter {
    type: typeof SKILL_ARCHIVE_TYPE;
    url: string;
    digest: string;
    version: string;
}

export interface SkillDistributionOptions {
    rootDir: string;
    outputDir: string;
    packageVersion: string;
    repositoryUrl: string;
}

export interface SkillDistributionResult {
    entry: SkillDiscoveryEntry;
    archivePath: string;
    latestMetadataPath: string;
    versionedMetadataPath: string;
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

function getVersionTag(packageVersion: string): string {
    return packageVersion.startsWith('v') ? packageVersion : `v${packageVersion}`;
}

function getAssetVersion(packageVersion: string): string {
    return packageVersion.startsWith('v') ? packageVersion.slice(1) : packageVersion;
}

function getSkillArchiveFileName(packageVersion: string): string {
    return `bkper-cli-skill-v${getAssetVersion(packageVersion)}.tar.gz`;
}

function getVersionedMetadataFileName(packageVersion: string): string {
    return `bkper-cli-skill-v${getAssetVersion(packageVersion)}.json`;
}

export function getReleaseAssetUrl(
    repositoryUrl: string,
    packageVersion: string,
    assetFileName: string
): string {
    const baseUrl = repositoryUrl.replace(/\.git$/, '');
    return `${baseUrl}/releases/download/${getVersionTag(packageVersion)}/${assetFileName}`;
}

function parseSkillFrontmatter(content: string): SkillFrontmatter {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) {
        throw new Error('skill/SKILL.md is missing YAML frontmatter');
    }

    const parsed: unknown = YAML.parse(match[1]);
    if (!isRecord(parsed)) {
        throw new Error('skill/SKILL.md frontmatter must be an object');
    }

    return {
        name: requireString(parsed.name, 'skill name'),
        description: requireString(parsed.description, 'skill description'),
    };
}

async function collectSkillFiles(
    directory: string,
    relativeDirectory = ''
): Promise<string[]> {
    const entries = (await readdir(directory, {withFileTypes: true})).sort((a, b) =>
        a.name.localeCompare(b.name)
    );
    const files: string[] = [];

    for (const entry of entries) {
        const relativePath = relativeDirectory
            ? `${relativeDirectory}/${entry.name}`
            : entry.name;
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...(await collectSkillFiles(fullPath, relativePath)));
            continue;
        }

        if (entry.isSymbolicLink()) {
            throw new Error(`Skill archive cannot contain symlinks: ${relativePath}`);
        }

        const stats = await lstat(fullPath);
        if (stats.isFile()) {
            files.push(relativePath);
        }
    }

    return files;
}

async function sha256File(filePath: string): Promise<string> {
    const bytes = await readFile(filePath);
    return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function createSkillDistributionAssets(
    options: SkillDistributionOptions
): Promise<SkillDistributionResult> {
    const skillDir = path.join(options.rootDir, 'skill');
    const skillPath = path.join(skillDir, 'SKILL.md');
    const skill = parseSkillFrontmatter(await readFile(skillPath, 'utf8'));
    const archiveFileName = getSkillArchiveFileName(options.packageVersion);
    const archivePath = path.join(options.outputDir, archiveFileName);
    const latestMetadataPath = path.join(
        options.outputDir,
        LATEST_SKILL_METADATA_FILE_NAME
    );
    const versionedMetadataPath = path.join(
        options.outputDir,
        getVersionedMetadataFileName(options.packageVersion)
    );
    const archiveEntries = await collectSkillFiles(skillDir);

    await mkdir(options.outputDir, {recursive: true});
    await createTar(
        {
            cwd: skillDir,
            file: archivePath,
            gzip: {portable: true},
            portable: true,
            noMtime: true,
        },
        archiveEntries
    );

    const entry: SkillDiscoveryEntry = {
        ...skill,
        type: SKILL_ARCHIVE_TYPE,
        url: getReleaseAssetUrl(
            options.repositoryUrl,
            options.packageVersion,
            archiveFileName
        ),
        digest: await sha256File(archivePath),
        version: getAssetVersion(options.packageVersion),
    };

    await writeJson(latestMetadataPath, entry);
    await writeJson(versionedMetadataPath, entry);

    return {
        entry,
        archivePath,
        latestMetadataPath,
        versionedMetadataPath,
    };
}
