import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveBkperJsDocPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', '..', 'docs', 'bkper-js.md');
}

describe('agent bkper-js doc', function () {
    it('should provide a non-empty markdown snapshot', function () {
        const markdown = readFileSync(resolveBkperJsDocPath(), 'utf8');
        expect(markdown.trim().length).to.be.greaterThan(0);
    });

    it('should include the required bkper-js headings', function () {
        const markdown = readFileSync(resolveBkperJsDocPath(), 'utf8');
        expect(markdown).to.include('# bkper-js');
        expect(markdown).to.include('## Classes');
        expect(markdown).to.include('### Book');
        expect(markdown).to.include('### Account');
        expect(markdown).to.include('### Transaction');
    });

    it('should include Bkper class documentation', function () {
        const markdown = readFileSync(resolveBkperJsDocPath(), 'utf8');
        expect(markdown).to.include('### Bkper');
    });
});
