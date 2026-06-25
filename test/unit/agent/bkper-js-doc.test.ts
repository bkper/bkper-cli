import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveBkperJsDocPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', '..', 'skill', 'references', 'sdk', 'bkper-js.md');
}

function readBkperJsDoc(): string {
    return readFileSync(resolveBkperJsDocPath(), 'utf8');
}

describe('agent bkper-js doc', function () {
    it('should provide a usable markdown snapshot', function () {
        const markdown = readBkperJsDoc().trimStart();

        expect(markdown.trim().length).to.be.greaterThan(0);
        expect(markdown).to.match(/^#\s+\S/m);
        expect(markdown.toLowerCase()).not.to.match(/^<!doctype html\b/);
        expect(markdown.toLowerCase()).not.to.match(/^<html\b/);
    });
});
