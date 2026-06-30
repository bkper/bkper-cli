import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { list as listTar } from 'tar';
import { expect } from '../helpers/test-setup.js';
import {
    createSkillDistributionAssets,
    getReleaseAssetUrl,
} from '../../../src/agent/skill-distribution.js';

describe('skill distribution assets', function () {
    const rootDir = path.resolve('.');
    let outputDir: string;

    beforeEach(async function () {
        outputDir = await mkdtemp(path.join(os.tmpdir(), 'bkper-skill-'));
    });

    afterEach(async function () {
        await rm(outputDir, { recursive: true, force: true });
    });

    it('builds immutable release asset URLs from the package repository', function () {
        const url = getReleaseAssetUrl(
            'https://github.com/bkper/bkper-cli.git',
            '4.18.0',
            'bkper-cli-skill-v4.18.0.tar.gz'
        );

        expect(url).to.equal(
            'https://github.com/bkper/bkper-cli/releases/download/v4.18.0/bkper-cli-skill-v4.18.0.tar.gz'
        );
    });

    it('packages the canonical skill with metadata for well-known discovery', async function () {
        const result = await createSkillDistributionAssets({
            rootDir,
            outputDir,
            packageVersion: '9.9.9',
            repositoryUrl: 'https://github.com/bkper/bkper-cli.git',
        });

        const archiveBytes = await readFile(result.archivePath);
        const expectedDigest = `sha256:${createHash('sha256').update(archiveBytes).digest('hex')}`;
        const latestMetadata = JSON.parse(await readFile(result.latestMetadataPath, 'utf8')) as unknown;
        const versionedMetadata = JSON.parse(await readFile(result.versionedMetadataPath, 'utf8')) as unknown;
        const archiveEntries: string[] = [];

        await listTar({
            file: result.archivePath,
            onReadEntry: entry => {
                archiveEntries.push(entry.path);
            },
        });

        expect(result.entry).to.deep.equal({
            name: 'bkper-cli',
            type: 'archive',
            description:
                'Provides Bkper CLI guidance for Bkper and adjacent accounting-support tasks — CLI usage, SDK code, data management, financial reports, taxes, accountant recommendations, app development, and safe bkper CLI operations from external coding agents.',
            url: 'https://github.com/bkper/bkper-cli/releases/download/v9.9.9/bkper-cli-skill-v9.9.9.tar.gz',
            digest: expectedDigest,
            version: '9.9.9',
        });
        expect(latestMetadata).to.deep.equal(result.entry);
        expect(versionedMetadata).to.deep.equal(result.entry);
        expect(archiveEntries).to.include('SKILL.md');
        expect(archiveEntries).to.include('references/index.md');
        expect(archiveEntries.every(entry => !entry.startsWith('skill/'))).to.equal(true);
    });
});
