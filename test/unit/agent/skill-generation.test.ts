import { expect } from '../helpers/test-setup.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { generateSkill } from '../../../scripts/generate-skill.js';

interface SkillMarkdown {
    frontmatter: Record<string, unknown>;
    body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSkillMarkdown(content: string): SkillMarkdown {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error('Skill markdown is missing frontmatter');
    }

    const frontmatter: unknown = YAML.parse(match[1]);
    if (!isRecord(frontmatter)) {
        throw new Error('Skill frontmatter is not an object');
    }

    return {
        frontmatter,
        body: match[2],
    };
}

async function readMarkdownFiles(dir: string): Promise<string[]> {
    const files = await readdir(dir);
    return files.filter(file => file.endsWith('.md')).sort();
}

describe('skill generation', function () {
    const docsDir = path.resolve('docs');
    const skillDir = path.resolve('..', 'skills', 'skills', 'bkper');
    const skillPath = path.join(skillDir, 'SKILL.md');
    const referencesDir = path.join(skillDir, 'references');

    let result: Awaited<ReturnType<typeof generateSkill>>;

    before(async function () {
        result = await generateSkill();
    });

    it('should generate SKILL.md with valid frontmatter and body', async function () {
        const content = await readFile(skillPath, 'utf8');
        const skill = parseSkillMarkdown(content);

        expect(skill.frontmatter.name).to.equal('bkper');
        expect(skill.frontmatter.description).to.be.a('string').and.not.equal('');
        expect(skill.body.trim().length).to.be.greaterThan(0);
    });

    it('should copy every markdown doc to references/', async function () {
        const expectedDocs = await readMarkdownFiles(docsDir);
        const copiedDocs = await readMarkdownFiles(referencesDir);

        expect(copiedDocs).to.deep.equal(expectedDocs);
        expect([...result.copiedDocs].sort()).to.deep.equal(expectedDocs);
    });

    it('should not create broken reference links in SKILL.md', async function () {
        const content = await readFile(skillPath, 'utf8');
        const copiedDocs = new Set(await readMarkdownFiles(referencesDir));
        const linkedDocs = Array.from(content.matchAll(/references\/([A-Za-z0-9-]+\.md)/g)).map(
            match => match[1]
        );

        expect(linkedDocs.length).to.be.greaterThan(0);
        expect(linkedDocs.every(doc => copiedDocs.has(doc))).to.equal(true);
    });

    it('should not contain template artifacts', async function () {
        const content = await readFile(skillPath, 'utf8');

        expect(content).not.to.include('buildToolPromptSection');
        expect(content).not.to.include('${');
    });

    it('should remove old bkper-* skills', async function () {
        const skillsRoot = path.resolve('..', 'skills', 'skills');
        const entries = await readdir(skillsRoot, { withFileTypes: true });
        const skillDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

        expect(skillDirs).to.include('bkper');
        expect(skillDirs.filter(name => name.startsWith('bkper-'))).to.deep.equal([]);
    });
});
