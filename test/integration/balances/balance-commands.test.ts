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

describe('CLI - balance commands', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-balances');
        bookId = await createTestBook(bookName);

        // Create a group
        await runBkperJson(['group', 'create', '-b', bookId, '--name', 'Assets']);

        // Create accounts
        await runBkperJson([
            'account',
            'create',
            '-b',
            bookId,
            '--name',
            'Cash',
            '--type',
            'ASSET',
            '--groups',
            'Assets',
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

        // Create and post transactions so balances exist
        const tx1 = await runBkperJson<bkper.Transaction>([
            'transaction',
            'create',
            '-b',
            bookId,
            '--date',
            '2025-01-10',
            '--amount',
            '1000',
            '--description',
            'Initial revenue',
            '--from',
            'Revenue',
            '--to',
            'Cash',
        ]);

        const tx2 = await runBkperJson<bkper.Transaction>([
            'transaction',
            'create',
            '-b',
            bookId,
            '--date',
            '2025-01-20',
            '--amount',
            '500',
            '--description',
            'Second revenue',
            '--from',
            'Revenue',
            '--to',
            'Cash',
        ]);

        // Post all transactions
        await runBkperJson(['transaction', 'post', tx1.id!, '-b', bookId]);
        await runBkperJson(['transaction', 'post', tx2.id!, '-b', bookId]);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('balance get', function () {
        it('should return a balance matrix for an account query', async function () {
            const result = await runBkperJson<unknown[][]>([
                'balance',
                'get',
                '-b',
                bookId,
                '-q',
                'account:Cash',
            ]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThan(1);
            // First row is headers, subsequent rows are data
            expect(result[0]).to.be.an('array');
        });

        it('should return a balance matrix for a group query', async function () {
            const result = await runBkperJson<unknown[][]>([
                'balance',
                'get',
                '-b',
                bookId,
                '-q',
                'group:Assets',
            ]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThan(1);
            expect(result[0]).to.be.an('array');
        });

        it('should return an expanded matrix when --expanded is specified', async function () {
            const result = await runBkperJson<unknown[][]>([
                'balance',
                'get',
                '-b',
                bookId,
                '-q',
                'group:Assets',
                '--expanded',
                '2',
            ]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThan(1);
            expect(result[0]).to.be.an('array');
        });

        it('should fail when missing required --query option', async function () {
            const result = await runBkper(['balance', 'get', '-b', bookId]);

            expect(result.exitCode).to.not.equal(0);
        });
    });
});
