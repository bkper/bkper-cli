import { expect } from 'chai';

import {
    extractRunnableQueryCommands,
    materializeCommand,
    type LiveCheckConfig,
} from '../../../src/docs-compliance/live-readme.js';

describe('docs-compliance live README checks', function () {
    it('should extract transaction/balance list query commands from README bash blocks', function () {
        const readme = `
\`\`\`bash
bkper transaction list -b abc123 -q "on:2025"
bkper account list -b abc123
bkper balance list -b <bookId> -q "on:2025-12-31"
\`\`\`
`;

        const commands = extractRunnableQueryCommands(readme);

        expect(commands).to.deep.equal([
            'bkper transaction list -b abc123 -q "on:2025"',
            'bkper balance list -b <bookId> -q "on:2025-12-31"',
        ]);
    });

    it('should join multiline commands with backslash continuations', function () {
        const readme = `
\`\`\`bash
bkper transaction list -b abc123 \\
  -q "on:2025"
\`\`\`
`;

        const commands = extractRunnableQueryCommands(readme);

        expect(commands).to.deep.equal([
            'bkper transaction list -b abc123 -q "on:2025"',
        ]);
    });

    it('should skip commands that contain shell pipes', function () {
        const readme = `
\`\`\`bash
bkper transaction list -b abc123 -q "on:2025" --format json | jq .
\`\`\`
`;

        const commands = extractRunnableQueryCommands(readme);

        expect(commands).to.deep.equal([]);
    });

    it('should materialize known placeholders and append csv output', function () {
        const config: LiveCheckConfig = {
            cliCmd: 'bkper',
            bookId: 'book-123',
            accountName: 'Cash',
            balanceSheetRootGroup: 'Total Equity',
            profitAndLossRootGroup: 'Profit & Loss',
        };

        const materialized = materializeCommand(
            "bkper balance list -b <bookId> -q \"account:'<accountName>' group:'<balanceSheetRootGroup>' before:2026-01-01\"",
            config
        );

        expect(materialized.skipReason).to.equal(undefined);
        expect(materialized.command).to.equal(
            "bkper balance list -b book-123 -q \"account:'Cash' group:'Total Equity' before:2026-01-01\" --format csv"
        );
    });

    it('should skip command when unresolved placeholders remain', function () {
        const config: LiveCheckConfig = {
            cliCmd: 'bkper',
            bookId: 'book-123',
        };

        const materialized = materializeCommand(
            "bkper balance list -b <bookId> -q \"group:'<profitAndLossRootGroup>' on:2025\"",
            config
        );

        expect(materialized.command).to.equal(undefined);
        expect(materialized.skipReason).to.contain('unresolved placeholders');
    });
});
