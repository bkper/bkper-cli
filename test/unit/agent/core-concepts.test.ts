import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveCoreConceptsPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(
        thisDir,
        '..',
        '..',
        '..',
        'skill',
        'references',
        'core-concepts.md'
    );
}

describe('agent core concepts', function () {
    it('should provide a non-empty markdown snapshot', function () {
        const markdown = readFileSync(resolveCoreConceptsPath(), 'utf8');
        expect(markdown.trim().length).to.be.greaterThan(0);
    });

    it('should not be an obvious html document', function () {
        const markdown = readFileSync(resolveCoreConceptsPath(), 'utf8').trimStart();
        expect(markdown.toLowerCase()).not.to.match(/^<!doctype html\b/);
        expect(markdown.toLowerCase()).not.to.match(/^<html\b/);
    });
});
