import { expect } from '../helpers/test-setup.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { generateSkill } from '../../../scripts/generate-skill.js';

describe('skill generation', function () {
    const skillDir = path.resolve('..', 'skills', 'skills', 'bkper-dev');
    const skillPath = path.join(skillDir, 'SKILL.md');
    const referencesDir = path.join(skillDir, 'references');

    let result: Awaited<ReturnType<typeof generateSkill>>;

    before(async function () {
        result = await generateSkill();
    });

    it('should generate SKILL.md with valid frontmatter', async function () {
        const content = await readFile(skillPath, 'utf8');

        expect(content).to.match(/^---\n/);
        expect(content).to.include('name: bkper-dev');
        expect(content).to.include('description:');
    });

    it('should copy all docs to references/', async function () {
        const files = await readdir(referencesDir);

        expect(files).to.include('core-concepts.md');
        expect(files).to.include('index.md');
        expect(files).to.include('data-management.md');
        expect(files).to.include('app-management.md');
        expect(files).to.include('financial-statements.md');
        expect(files).to.include('bkper-js.md');
        expect(files).to.include('bkper-api-types.md');
        expect(files.length).to.equal(result.copiedDocs.length);
    });

    it('should contain core Bkper context phrases', async function () {
        const content = await readFile(skillPath, 'utf8');

        expect(content).to.include('Protect the zero-sum invariant above all else.');
        expect(content).to.include('Think in resources, movements, and balances');
        expect(content).to.include('references/core-concepts.md');
        expect(content).to.include('references/index.md');
    });

    it('should not contain tool-specific guidance or build artifacts', async function () {
        const content = await readFile(skillPath, 'utf8');

        expect(content).not.to.include('Available tools:');
        expect(content).not.to.include('buildToolPromptSection');
        expect(content).not.to.include('${');
    });

    it('should remove old bkper-* skills', async function () {
        const skillsRoot = path.resolve('..', 'skills', 'skills');
        const entries = await readdir(skillsRoot, { withFileTypes: true });
        const skillDirs = entries
            .filter(e => e.isDirectory())
            .map(e => e.name);

        expect(skillDirs).to.deep.equal(['bkper-dev']);
    });
});
