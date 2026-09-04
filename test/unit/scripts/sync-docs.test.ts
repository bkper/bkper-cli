import { expect } from '../helpers/test-setup.js';
import {
    discoverAppDocSpecs,
    findStaleAppDocNames,
    validateMarkdown,
} from '../../../scripts/sync-docs.js';

describe('sync docs validation', function () {
    it('should discover individual app documents from the lightweight index in order', function () {
        const index = `# Apps

- [Overview](https://bkper.com/docs/platform/apps/overview.md): Platform overview.
- [Event Handlers](https://bkper.com/docs/platform/apps/event-handlers.md): Event reference.
`;

        expect(discoverAppDocSpecs(index)).to.deep.equal([
            {
                url: 'https://bkper.com/docs/platform/apps/overview.md',
                outputPath: 'apps/overview.md',
            },
            {
                url: 'https://bkper.com/docs/platform/apps/event-handlers.md',
                outputPath: 'apps/event-handlers.md',
            },
        ]);
    });

    it('should reject an app index without canonical document links', function () {
        expect(() => discoverAppDocSpecs('# Apps')).to.throw(
            'App docs index contains no canonical document links.'
        );
    });

    it('should reject duplicate canonical app document links', function () {
        const index = `- [Overview](https://bkper.com/docs/platform/apps/overview.md)
- [Overview again](https://bkper.com/docs/platform/apps/overview.md)`;

        expect(() => discoverAppDocSpecs(index)).to.throw(
            'App docs index contains duplicate link: apps/overview.md.'
        );
    });

    it('should ignore links outside the canonical app docs section', function () {
        const index = `- [AI Provider](https://bkper.com/docs/ai/bkper-ai-provider.md)
- [Overview](https://bkper.com/docs/platform/apps/overview.md)`;

        expect(discoverAppDocSpecs(index)).to.deep.equal([
            {
                url: 'https://bkper.com/docs/platform/apps/overview.md',
                outputPath: 'apps/overview.md',
            },
        ]);
    });

    it('should identify stale app docs in deterministic order', function () {
        const specs = discoverAppDocSpecs(
            '- [Overview](https://bkper.com/docs/platform/apps/overview.md)'
        );

        expect(
            findStaleAppDocNames(
                ['overview.md', 'notes.txt', 'app-building.md', 'old.md'],
                specs
            )
        ).to.deep.equal(['app-building.md', 'old.md']);
    });

    it('should accept non-empty markdown without enforcing headings', function () {
        expect(() =>
            validateMarkdown('# Renamed title\n\nSome content.', {
                url: 'https://example.com/doc.md',
                outputPath: 'doc.md',
            })
        ).not.to.throw();
    });

    it('should reject empty markdown', function () {
        expect(() =>
            validateMarkdown('   \n\n', {
                url: 'https://example.com/doc.md',
                outputPath: 'doc.md',
            })
        ).to.throw('doc.md: fetched markdown is empty.');
    });

    it('should reject obvious html responses', function () {
        expect(() =>
            validateMarkdown('<!DOCTYPE html><html><body>Error</body></html>', {
                url: 'https://example.com/doc.md',
                outputPath: 'doc.md',
            })
        ).to.throw('doc.md: fetched content looks like HTML, not markdown.');
    });
});
