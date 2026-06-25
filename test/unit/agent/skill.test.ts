import { expect } from '../helpers/test-setup.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

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

function getReferenceLinks(content: string): string[] {
    return Array.from(content.matchAll(/references\/([A-Za-z0-9-]+\.md)/g)).map(
        match => match[1]
    );
}

describe('external agent skill', function () {
    const docsDir = path.resolve('docs');
    const docsIndexPath = path.join(docsDir, 'index.md');
    const skillDir = path.resolve('skill');
    const skillPath = path.join(skillDir, 'SKILL.md');
    const referencesDir = path.join(skillDir, 'references');

    async function readSkill(): Promise<SkillMarkdown> {
        return parseSkillMarkdown(await readFile(skillPath, 'utf8'));
    }

    it('should keep the maintained SKILL.md valid', async function () {
        const skill = await readSkill();

        expect(skill.frontmatter.name).to.equal('bkper-cli');
        expect(skill.frontmatter.description).to.be.a('string').and.not.equal('');
        expect(String(skill.frontmatter.description).length).to.be.lessThanOrEqual(1024);
        expect(skill.frontmatter['disable-model-invocation']).not.to.equal(true);
        expect(skill.body.trim().length).to.be.greaterThan(0);
    });

    it('should keep the skill trigger aligned with built-in Bkper routing', async function () {
        const skill = await readSkill();
        const description = String(skill.frontmatter.description).toLowerCase();

        for (const term of [
            'bkper',
            'adjacent accounting-support task',
            'cli usage',
            'sdk code',
            'data management',
            'financial reports',
            'taxes',
            'accountant recommendations',
        ]) {
            expect(description).to.include(term);
        }
    });

    it('should keep only the built-in routing index in docs/', async function () {
        expect(await readMarkdownFiles(docsDir)).to.deep.equal(['index.md']);
    });

    it('should keep reference docs in skill/references for the built-in index', async function () {
        const indexContent = await readFile(docsIndexPath, 'utf8');
        const indexedDocs = Array.from(
            indexContent.matchAll(/\*\*([A-Za-z0-9-]+\.md)\*\*/g)
        ).map(match => match[1]);
        const referenceDocs = await readMarkdownFiles(referencesDir);
        const expectedDocs = [...new Set([...indexedDocs, 'core-concepts.md'])].sort();

        expect(referenceDocs).to.deep.equal(expectedDocs);
        expect(referenceDocs).not.to.include('index.md');
    });

    it('should route directly to end reference docs without requiring an index hop', async function () {
        const content = await readFile(skillPath, 'utf8');
        const referenceDocs = (await readMarkdownFiles(referencesDir)).filter(
            doc => doc !== 'index.md'
        );
        const linkedDocs = new Set(getReferenceLinks(content));

        expect(linkedDocs.has('index.md')).to.equal(false);
        for (const doc of referenceDocs) {
            expect(linkedDocs.has(doc), `${doc} should be linked from SKILL.md`).to.equal(true);
        }
    });

    it('should not create broken reference links in SKILL.md', async function () {
        const content = await readFile(skillPath, 'utf8');
        const copiedDocs = new Set(await readMarkdownFiles(referencesDir));
        const linkedDocs = getReferenceLinks(content);

        expect(linkedDocs.length).to.be.greaterThan(0);
        expect(linkedDocs.every(doc => copiedDocs.has(doc))).to.equal(true);
    });

    it('should not contain generation artifacts', async function () {
        const content = await readFile(skillPath, 'utf8');

        expect(content).not.to.include('auto-generated');
        expect(content).not.to.include('buildToolPromptSection');
        expect(content).not.to.include('${');
    });
});
