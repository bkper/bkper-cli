import { expect } from '../helpers/test-setup.js';
import {
    discoverAppDocSpecs,
    findStaleAppDocNames,
    validateMarkdown,
} from '../../../scripts/sync-docs.js';

describe('sync docs validation', function () {
    it('should discover individual app documents in manifest order', function () {
        const manifest = `# Apps (Full)

---
source: /docs/build/apps/overview.md

# Overview

---
source: /docs/build/apps/event-handlers.md

# Event Handlers
`;

        expect(discoverAppDocSpecs(manifest)).to.deep.equal([
            {
                url: 'https://bkper.com/docs/build/apps/overview.md',
                outputPath: 'apps/overview.md',
            },
            {
                url: 'https://bkper.com/docs/build/apps/event-handlers.md',
                outputPath: 'apps/event-handlers.md',
            },
        ]);
    });

    it('should reject an app manifest without canonical document sources', function () {
        expect(() => discoverAppDocSpecs('# Apps (Full)')).to.throw(
            'App docs manifest contains no canonical document sources.'
        );
    });

    it('should reject duplicate canonical app document sources', function () {
        const manifest = `source: /docs/build/apps/overview.md
source: /docs/build/apps/overview.md`;

        expect(() => discoverAppDocSpecs(manifest)).to.throw(
            'App docs manifest contains duplicate source: apps/overview.md.'
        );
    });

    it('should identify stale app docs in deterministic order', function () {
        const specs = discoverAppDocSpecs(
            'source: /docs/build/apps/overview.md'
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
