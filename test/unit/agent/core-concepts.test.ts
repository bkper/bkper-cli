import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../helpers/test-setup.js';

function resolveCoreConceptsPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(thisDir, '..', '..', '..', 'docs', 'core-concepts.md');
}

describe('agent core concepts', function () {
    it('should provide a non-empty markdown snapshot', function () {
        const markdown = readFileSync(resolveCoreConceptsPath(), 'utf8');
        expect(markdown.trim().length).to.be.greaterThan(0);
    });

    it('should include the required core concepts headings', function () {
        const markdown = readFileSync(resolveCoreConceptsPath(), 'utf8');
        expect(markdown).to.include('# Core Concepts');
        expect(markdown).to.include('## Accounts');
        expect(markdown).to.include('## Transactions');
        expect(markdown).to.include('## Books');
    });

    it('should preserve markdown examples with backticks', function () {
        const markdown = readFileSync(resolveCoreConceptsPath(), 'utf8');
        expect(markdown).to.include("These examples use Bkper's transaction shorthand `From >> To`");
    });
});
