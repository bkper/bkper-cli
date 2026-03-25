import { expect } from '../helpers/test-setup.js';
import { CORE_CONCEPTS_MARKDOWN } from '../../../src/agent/core-concepts.js';

describe('agent core concepts', function () {
    it('should export non-empty markdown', function () {
        expect(CORE_CONCEPTS_MARKDOWN.trim().length).to.be.greaterThan(0);
    });

    it('should include the required core concepts headings', function () {
        expect(CORE_CONCEPTS_MARKDOWN).to.include('# Core Concepts');
        expect(CORE_CONCEPTS_MARKDOWN).to.include('## Accounts');
        expect(CORE_CONCEPTS_MARKDOWN).to.include('## Transactions');
        expect(CORE_CONCEPTS_MARKDOWN).to.include('## Books');
    });

    it('should preserve markdown examples with backticks', function () {
        expect(CORE_CONCEPTS_MARKDOWN).to.include("These examples use Bkper's transaction shorthand `From >> To`");
    });
});
