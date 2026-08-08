import { expect } from 'chai';

import { evaluateReadmeCompliance } from '../../../src/docs-compliance/rules.js';

describe('docs-compliance rules', function () {
    it('should pass safe command examples without requiring reference guidance', function () {
        const readme = `
\`\`\`bash
bkper transaction list -b abc123 -q 'on:2025'
bkper transaction list -b abc123 -q 'after:$m-1 before:$m+1'
bkper balance list -b abc123 -q 'on:2025-12-31'
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
        const readme = "bkper balance list -b abc123 -q 'period:2025-01'";

        const result = evaluateReadmeCompliance(readme);

        expect(result.errors.some(e => e.code === 'period-operator-in-query-example')).to.equal(
            true
        );
    });

    it('should fail when a date variable query example is double quoted', function () {
        const readme = 'bkper transaction list -b abc123 -q "after:$m-1 before:$m+1"';

        const result = evaluateReadmeCompliance(readme);

        expect(
            result.errors.some(e => e.code === 'double-quoted-date-variable-query-example')
        ).to.equal(true);
    });

    it('should report when README documents group stdin batch creation', function () {
        const readme = `
Write commands (\`account create\`, \`group create\`, \`transaction create\`) accept JSON data piped via stdin.
\`\`\`bash
bkper group list -b $BOOK_A --format json | bkper group create -b $BOOK_B
\`\`\`

**Group** (\`bkper.Group\`)
`;

        const result = evaluateReadmeCompliance(readme);
        const codes = result.errors.map(e => e.code);
        expect(codes).to.include('group-create-stdin-documented');
        expect(codes).to.include('group-create-pipe-documented');
        expect(codes).to.include('group-stdin-fields-documented');
    });

    it('should report when README documents internal release workflow details', function () {
        const readme = `
Use the \`release:patch\` label on PRs. Publishing is handled by GitHub Actions and CI/CD after merge.
`;

        const result = evaluateReadmeCompliance(readme);
        const codes = result.errors.map(e => e.code);
        expect(codes).to.include('internal-release-process-documented');
    });
});
