import { expect } from 'chai';

import { evaluateReadmeCompliance } from '../../../src/docs-compliance/rules.js';

describe('docs-compliance rules', function () {
    it('should pass when README content follows required rules', function () {
        const readme = `
### Query semantics (transactions and balances)
-   \`on:2025\` → full year
-   \`after:\` is **inclusive** and \`before:\` is **exclusive**.

### Output Format
**LLM-first output guidance (important):**
-   **LLM consumption of lists/reports** → CSV
-   **Programmatic processing / pipelines** → JSON

\`\`\`bash
bkper transaction list -b abc123 -q "on:2025"
bkper balance list -b abc123 -q "on:2025-12-31"
\`\`\`
`;

        const result = evaluateReadmeCompliance(readme);
        expect(result.errors).to.deep.equal([]);
    });

    it('should fail when transaction list command misses -q', function () {
        const readme = 'bkper transaction list -b abc123 --format csv';

        const result = evaluateReadmeCompliance(readme);

        expect(result.errors.some(e => e.code === 'transaction-list-missing-query')).to
            .equal(true);
    });

    it('should fail when balance list command misses -q', function () {
        const readme = 'bkper balance list -b abc123 --format csv';

        const result = evaluateReadmeCompliance(readme);

        expect(result.errors.some(e => e.code === 'balance-list-missing-query')).to.equal(
            true
        );
    });

    it('should fail when same-day after/before anti-pattern is used', function () {
        const readme = '-q "after:$DATE before:$DATE"';

        const result = evaluateReadmeCompliance(readme);

        expect(result.errors.some(e => e.code === 'same-day-range-antipattern')).to.equal(
            true
        );
    });

    it('should fail when period: is used in query examples', function () {
        const readme = 'bkper balance list -b abc123 -q "period:2025-01"';

        const result = evaluateReadmeCompliance(readme);

        expect(result.errors.some(e => e.code === 'period-operator-in-query-example')).to.equal(
            true
        );
    });

    it('should report missing guidance sections', function () {
        const readme = 'bkper transaction list -b abc123 -q "on:2025"';

        const result = evaluateReadmeCompliance(readme);

        const codes = result.errors.map(e => e.code);
        expect(codes).to.include('missing-llm-guidance-title');
        expect(codes).to.include('missing-csv-guidance');
        expect(codes).to.include('missing-json-guidance');
        expect(codes).to.include('missing-query-semantics-section');
        expect(codes).to.include('missing-after-before-semantics');
    });
});
