import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {extractRunnableQueryCommands, materializeCommand} from '../../../src/docs-compliance/live-readme.js';

function run(command: string): {ok: boolean; output: string} {
    const result = spawnSync(command, {
        shell: true,
        encoding: 'utf8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    return {ok: result.status === 0, output};
}

function isAcceptableCsvOutput(output: string): boolean {
    const normalized = output.trim();
    if (!normalized) {
        return false;
    }

    if (normalized === 'No results found.') {
        return true;
    }

    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) {
        return false;
    }

    const header = lines[0];
    return header.includes(',');
}

function main(): void {
    const cliCmd = process.env.BKPER_DOCS_CLI_CMD ?? 'bkper';

    // Fixed defaults for local live checks. Env vars can override when needed.
    const bookId =
        process.env.BKPER_DOCS_TEST_BOOK_ID ??
        'agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgKTP5LcJDA'; // Bkper Finances
    const accountName = process.env.BKPER_DOCS_TEST_ACCOUNT_NAME ?? 'Brex Cash';
    const balanceSheetRootGroup =
        process.env.BKPER_DOCS_TEST_BS_GROUP ?? 'Bkper Balance Sheet';
    const profitAndLossRootGroup =
        process.env.BKPER_DOCS_TEST_PL_GROUP ?? 'Bkper Profit & Loss';

    const readmePath = path.resolve(process.cwd(), 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    const commands = extractRunnableQueryCommands(readmeContent);

    let executed = 0;
    let skipped = 0;
    let failures = 0;

    for (const templateCommand of commands) {
        const materialized = materializeCommand(templateCommand, {
            cliCmd,
            bookId,
            accountName,
            balanceSheetRootGroup,
            profitAndLossRootGroup,
        });

        if (!materialized.command) {
            skipped++;
            console.log(`- skipped: ${materialized.skipReason}`);
            continue;
        }

        const result = run(materialized.command);
        executed++;

        if (!result.ok) {
            failures++;
            console.error(`✗ ${materialized.command}`);
            console.error(`  output: ${result.output}`);
            continue;
        }

        if (!isAcceptableCsvOutput(result.output)) {
            failures++;
            console.error(`✗ ${materialized.command}`);
            console.error('  output is not valid CSV-like content');
            console.error(`  output: ${result.output}`);
            continue;
        }

        if (result.output.trim() === 'No results found.') {
            console.log(`✓ ${materialized.command} (no results)`);
        } else {
            console.log(`✓ ${materialized.command}`);
        }
    }

    console.log(
        `Live docs checks summary: executed=${executed}, skipped=${skipped}, failed=${failures}`
    );

    if (failures > 0) {
        process.exit(1);
    }
}

main();
