import { expect } from '../helpers/test-setup.js';
import { validateMarkdown } from '../../../scripts/sync-docs.js';

describe('sync docs validation', function () {
    it('should accept non-empty markdown without enforcing headings', function () {
        expect(() =>
            validateMarkdown('# Renamed title\n\nSome content.', {
                url: 'https://example.com/doc.md',
                filename: 'doc.md',
            })
        ).not.to.throw();
    });

    it('should reject empty markdown', function () {
        expect(() =>
            validateMarkdown('   \n\n', {
                url: 'https://example.com/doc.md',
                filename: 'doc.md',
            })
        ).to.throw('doc.md: fetched markdown is empty.');
    });

    it('should reject obvious html responses', function () {
        expect(() =>
            validateMarkdown('<!DOCTYPE html><html><body>Error</body></html>', {
                url: 'https://example.com/doc.md',
                filename: 'doc.md',
            })
        ).to.throw('doc.md: fetched content looks like HTML, not markdown.');
    });
});
