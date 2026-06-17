import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveBkperApiTypesDocPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', '..', 'docs', 'bkper-api-types.md');
}

function readBkperApiTypesDoc(): string {
    return readFileSync(resolveBkperApiTypesDocPath(), 'utf8');
}

describe('agent bkper-api-types doc', function () {
    it('should provide a usable markdown snapshot', function () {
        const markdown = readBkperApiTypesDoc().trimStart();

        expect(markdown.trim().length).to.be.greaterThan(0);
        expect(markdown).to.match(/^#\s+\S/m);
        expect(markdown.toLowerCase()).not.to.match(/^<!doctype html\b/);
        expect(markdown.toLowerCase()).not.to.match(/^<html\b/);
    });
});
