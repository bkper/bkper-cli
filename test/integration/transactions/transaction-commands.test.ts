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

describe('CLI - transaction commands', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-transactions');
        bookId = await createTestBook(bookName);

        // Seed accounts for transactions
        await runBkperJson(['account', 'create', bookId, '--name', 'Cash', '--type', 'ASSET']);
        await runBkperJson([
            'account',
            'create',
            bookId,
            '--name',
            'Revenue',
            '--type',
            'INCOMING',
        ]);
        await runBkperJson([
            'account',
            'create',
            bookId,
            '--name',
            'Expenses',
            '--type',
            'OUTGOING',
        ]);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('transaction create', function () {
        it('should create a single transaction', async function () {
            const txData = JSON.stringify([
                {
                    date: '2025-01-15',
                    amount: 100,
                    description: 'Test sale',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);

            const result = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);

            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].amount).to.exist;
            expect(result[0].description).to.equal('Test sale');
        });

        it('should create multiple transactions in batch', async function () {
            const txData = JSON.stringify([
                {
                    date: '2025-01-16',
                    amount: 50,
                    description: 'Batch tx 1',
                    from: 'Revenue',
                    to: 'Cash',
                },
                {
                    date: '2025-01-17',
                    amount: 30,
                    description: 'Batch tx 2',
                    from: 'Cash',
                    to: 'Expenses',
                },
            ]);

            const result = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);

            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
        });

        it('should create a transaction with properties', async function () {
            const txData = JSON.stringify([
                {
                    date: '2025-01-18',
                    amount: 75,
                    description: 'With properties',
                    from: 'Revenue',
                    to: 'Cash',
                    properties: { invoice: 'INV-001' },
                },
            ]);

            const result = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);

            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].properties).to.deep.include({ invoice: 'INV-001' });
        });
    });

    describe('transaction list', function () {
        it('should list transactions with a query', async function () {
            const result = await runBkperJson<{ items: bkper.Transaction[]; cursor?: string }>([
                'transaction',
                'list',
                bookId,
                '-q',
                'after:01/01/2025',
            ]);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.items.length).to.be.greaterThan(0);
        });

        it('should respect the limit option', async function () {
            const result = await runBkperJson<{ items: bkper.Transaction[]; cursor?: string }>([
                'transaction',
                'list',
                bookId,
                '-q',
                'after:01/01/2025',
                '-l',
                '1',
            ]);

            expect(result).to.be.an('object');
            expect(result.items).to.be.an('array');
            expect(result.items).to.have.length.at.most(1);
        });
    });

    describe('transaction post', function () {
        it('should post a draft transaction', async function () {
            // Create a draft transaction
            const txData = JSON.stringify([
                {
                    date: '2025-02-01',
                    amount: 200,
                    description: 'Draft to post',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);
            const created = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);
            const txId = created[0].id!;

            // Post the transaction
            const result = await runBkperJson<bkper.Transaction>([
                'transaction',
                'post',
                bookId,
                txId,
            ]);

            expect(result).to.be.an('object');
            expect(result.id).to.equal(txId);
            expect(result.posted).to.equal(true);
        });
    });

    describe('transaction check', function () {
        it('should check a posted transaction', async function () {
            // Create and post a transaction
            const txData = JSON.stringify([
                {
                    date: '2025-02-02',
                    amount: 150,
                    description: 'To check',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);
            const created = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);
            const txId = created[0].id!;

            await runBkperJson<bkper.Transaction>(['transaction', 'post', bookId, txId]);

            // Check the transaction
            const result = await runBkperJson<bkper.Transaction>([
                'transaction',
                'check',
                bookId,
                txId,
            ]);

            expect(result).to.be.an('object');
            expect(result.id).to.equal(txId);
            expect(result.checked).to.equal(true);
        });
    });

    describe('transaction trash', function () {
        it('should trash a transaction', async function () {
            // Create a transaction
            const txData = JSON.stringify([
                {
                    date: '2025-02-03',
                    amount: 80,
                    description: 'To trash',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);
            const created = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                txData,
            ]);
            const txId = created[0].id!;

            // Trash the transaction
            const result = await runBkperJson<bkper.Transaction>([
                'transaction',
                'trash',
                bookId,
                txId,
            ]);

            expect(result).to.be.an('object');
            expect(result.id).to.equal(txId);
            expect(result.trashed).to.equal(true);
        });
    });

    describe('transaction merge', function () {
        it('should merge two transactions with matching amounts', async function () {
            // Create two transactions with the same amount
            const tx1Data = JSON.stringify([
                {
                    date: '2025-02-04',
                    amount: 500,
                    description: 'Merge source 1',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);
            const tx2Data = JSON.stringify([
                {
                    date: '2025-02-04',
                    amount: 500,
                    description: 'Merge source 2',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);

            const created1 = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                tx1Data,
            ]);
            const created2 = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                tx2Data,
            ]);

            const txId1 = created1[0].id!;
            const txId2 = created2[0].id!;

            // Post both transactions before merging
            await runBkperJson(['transaction', 'post', bookId, txId1]);
            await runBkperJson(['transaction', 'post', bookId, txId2]);

            const result = await runBkperJson<{
                mergedTransaction: bkper.Transaction;
                revertedTransactionId: string;
                auditRecord: string | null;
            }>(['transaction', 'merge', bookId, txId1, txId2]);

            expect(result).to.be.an('object');
            expect(result.mergedTransaction).to.be.an('object');
            expect(result.revertedTransactionId).to.be.a('string');
        });

        it('should fail to merge transactions with different amounts', async function () {
            const tx1Data = JSON.stringify([
                {
                    date: '2025-02-05',
                    amount: 100,
                    description: 'Different amount 1',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);
            const tx2Data = JSON.stringify([
                {
                    date: '2025-02-05',
                    amount: 200,
                    description: 'Different amount 2',
                    from: 'Revenue',
                    to: 'Cash',
                },
            ]);

            const created1 = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                tx1Data,
            ]);
            const created2 = await runBkperJson<bkper.Transaction[]>([
                'transaction',
                'create',
                bookId,
                '--transactions',
                tx2Data,
            ]);

            const txId1 = created1[0].id!;
            const txId2 = created2[0].id!;

            await runBkperJson(['transaction', 'post', bookId, txId1]);
            await runBkperJson(['transaction', 'post', bookId, txId2]);

            const result = await runBkper(['transaction', 'merge', bookId, txId1, txId2]);

            expect(result.exitCode).to.not.equal(0);
        });
    });

    describe('transaction error handling', function () {
        it('should fail for a non-existent transaction ID', async function () {
            const result = await runBkper(['transaction', 'post', bookId, 'nonexistent-id']);

            expect(result.exitCode).to.not.equal(0);
        });

        it('should fail when missing required --transactions option', async function () {
            const result = await runBkper(['transaction', 'create', bookId]);

            expect(result.exitCode).to.not.equal(0);
        });

        it('should fail when missing required --query option for list', async function () {
            const result = await runBkper(['transaction', 'list', bookId]);

            expect(result.exitCode).to.not.equal(0);
        });
    });
});
