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
        const txData = JSON.stringify([
            {
                date: '2025-01-10',
                amount: 1000,
                description: 'Initial revenue',
                from: 'Revenue',
                to: 'Cash',
            },
            {
                date: '2025-01-20',
                amount: 500,
                description: 'Second revenue',
                from: 'Revenue',
                to: 'Cash',
            },
        ]);
        const created = await runBkperJson<bkper.Transaction[]>([
            'transaction',
            'create',
            '-b',
            bookId,
            '--transactions',
            txData,
        ]);

        // Post all transactions
        for (const tx of created) {
            await runBkperJson(['transaction', 'post', tx.id!, '-b', bookId]);
        }
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('balance get', function () {
        it('should return balances for an account query', async function () {
            const result = await runBkperJson<{
                items: Array<{
                    accountOrGroup: string;
                    periodBalance: string;
                    cumulativeBalance: string;
                }>;
            }>(['balance', 'get', '-b', bookId, '-q', 'account:Cash']);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.items.length).to.be.greaterThan(0);

            const cashBalance = result.items.find(i => i.accountOrGroup === 'Cash');
            expect(cashBalance).to.exist;
        });

        it('should return balances for a group query', async function () {
            const result = await runBkperJson<{
                items: Array<{
                    accountOrGroup: string;
                    periodBalance: string;
                    cumulativeBalance: string;
                }>;
            }>(['balance', 'get', '-b', bookId, '-q', 'group:Assets']);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.items.length).to.be.greaterThan(0);
        });

        it('should include raw matrix when --raw is specified', async function () {
            const result = await runBkperJson<{
                items: Array<{
                    accountOrGroup: string;
                    periodBalance: string;
                    cumulativeBalance: string;
                }>;
                matrix?: unknown[][];
            }>(['balance', 'get', '-b', bookId, '-q', 'account:Cash', '--raw']);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.matrix).to.be.an('array');
        });

        it('should include expanded matrix when --expanded is specified', async function () {
            const result = await runBkperJson<{
                items: Array<{
                    accountOrGroup: string;
                    periodBalance: string;
                    cumulativeBalance: string;
                }>;
                matrix?: unknown[][];
            }>(['balance', 'get', '-b', bookId, '-q', 'group:Assets', '--expanded', '2']);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.matrix).to.be.an('array');
        });

        it('should fail when missing required --query option', async function () {
            const result = await runBkper(['balance', 'get', '-b', bookId]);

            expect(result.exitCode).to.not.equal(0);
        });
    });
});
