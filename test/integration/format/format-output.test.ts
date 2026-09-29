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

    describe('JSON by default', function () {
        it('should output an items envelope for lists without any flag', async function () {
            const result = await runBkper(['account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.have.property('items').that.is.an('array');
            const names = parsed.items.map((a: bkper.Account) => a.name);
            expect(names).to.include.members(['Cash', 'Revenue']);
        });

        it('should place one record per line in list output', async function () {
            const result = await runBkper(['account', 'list', '-b', bookId]);

            const recordLines = result.stdout
                .split('\n')
                .filter(line => line.startsWith('{"') && !line.startsWith('{"items"'));
            expect(recordLines.length).to.be.greaterThanOrEqual(2);
            for (const line of recordLines) {
                expect(() => JSON.parse(line.replace(/,$/, ''))).to.not.throw();
            }
        });

        it('should output compact JSON for a single item when not on a terminal', async function () {
            const result = await runBkper(['account', 'get', 'Cash', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            expect(result.stdout.trim().split('\n')).to.have.length(1);
            expect(JSON.parse(result.stdout).name).to.equal('Cash');
        });
    });

    describe('legacy flags', function () {
        it('should accept --json as a no-op', async function () {
            const result = await runBkper(['--json', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            expect(JSON.parse(result.stdout)).to.have.property('items');
        });

        it('should accept --format json as a no-op', async function () {
            const result = await runBkper(['--format', 'json', 'account', 'list', '-b', bookId]);

            expect(result.exitCode).to.equal(0);
            expect(JSON.parse(result.stdout)).to.have.property('items');
        });

        for (const legacy of ['table', 'csv']) {
            it(`should fail with jq guidance for --format ${legacy}`, async function () {
                const result = await runBkper(['--format', legacy, 'account', 'list', '-b', bookId]);

                expect(result.exitCode).to.not.equal(0);
                expect(result.stdout).to.equal('');
                expect(result.stderr).to.contain('JSON only');
                expect(result.stderr).to.contain('jq');
            });
        }
    });
});
