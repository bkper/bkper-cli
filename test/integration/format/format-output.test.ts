import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkper,
    runBkperJson,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - output format', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-format');
        bookId = await createTestBook(bookName);

        // Seed some accounts
        await runBkperJson([
            'account',
            'create',
            '-b',
            bookId,
            '--name',
            'Cash',
            '--type',
            'ASSET',
        ]);
        await runBkperJson([
            'account',
            'create',
            '-b',
            bookId,
            '--name',
            'Revenue',
            '--type',
            'INCOMING',
        ]);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('--format table (default)', function () {
        it('should output table format for account list', async function () {
            const result = await runBkper(['account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            // Table format should have aligned columns and underscore divider
            expect(result.stdout).to.contain('Cash');
            expect(result.stdout).to.contain('Revenue');
            expect(result.stdout).to.match(/_+/);
        });

        it('should output key-value format for single item', async function () {
            const result = await runBkper(['account', 'get', 'Cash', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            expect(result.stdout).to.contain('name:');
            expect(result.stdout).to.contain('Cash');
        });
    });

    describe('--format json', function () {
        it('should output valid JSON array for list', async function () {
            const result = await runBkper(['--format', 'json', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array');
        });

        it('should output valid JSON object for single item', async function () {
            const result = await runBkper([
                '--format',
                'json',
                'account',
                'get',
                'Cash',
                '-b',
                bookId,
            ]);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('object');
            expect(parsed.name).to.equal('Cash');
        });
    });

    describe('--json (backward compatibility)', function () {
        it('should work as alias for --format json', async function () {
            const result = await runBkper(['--json', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array');
        });
    });

    describe('--format csv', function () {
        it('should output CSV for account list', async function () {
            const result = await runBkper(['--format', 'csv', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split(/\r?\n/);
            // Should have at least a header row and two data rows
            expect(lines.length).to.be.greaterThanOrEqual(3);
            // First line should be headers
            expect(lines[0]).to.contain('Name');
        });

        it('should fall back to JSON for single item', async function () {
            const result = await runBkper([
                '--format',
                'csv',
                'account',
                'get',
                'Cash',
                '-b',
                bookId,
            ]);

            expect(result.exitCode).to.equal(0);
            // renderItem falls back to JSON for csv format
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('object');
            expect(parsed.name).to.equal('Cash');
        });

        it('should include IDs in CSV output', async function () {
            const result = await runBkper(['--format', 'csv', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split(/\r?\n/);
            // CSV builder is configured with .ids(true), header is "Account Id"
            expect(lines[0]).to.contain('Id');
        });
    });
});
