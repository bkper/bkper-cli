import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveBkperApiTypesDocPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', '..', 'docs', 'bkper-api-types.md');
}

describe('agent bkper-api-types doc', function () {
    it('should provide a non-empty markdown snapshot', function () {
        const markdown = readFileSync(resolveBkperApiTypesDocPath(), 'utf8');
        expect(markdown.trim().length).to.be.greaterThan(0);
    });

    it('should include the required bkper-api-types headings', function () {
        const markdown = readFileSync(resolveBkperApiTypesDocPath(), 'utf8');
        expect(markdown).to.include('# bkper-api-types');
        expect(markdown).to.include('## Interfaces');
        expect(markdown).to.include('### Account');
        expect(markdown).to.include('### Book');
        expect(markdown).to.include('### Transaction');
    });
});
