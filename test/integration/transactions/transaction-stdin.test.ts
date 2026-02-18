import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkper,
    runBkperJson,
    runBkperWithStdin,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - transaction stdin', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-tx-stdin');
        bookId = await createTestBook(bookName);

        // Seed accounts
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
        await runBkperJson([
            'account',
            'create',
            '-b',
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

    describe('JSON stdin', function () {
        it('should create transactions from JSON array', async function () {
            const jsonInput = JSON.stringify([
                {
                    date: '2025-03-01',
                    amount: '100',
                    description: 'Stdin JSON tx 1',
                    creditAccount: 'Revenue',
                    debitAccount: 'Cash',
                },
                {
                    date: '2025-03-02',
                    amount: '200',
                    description: 'Stdin JSON tx 2',
                    creditAccount: 'Cash',
                    debitAccount: 'Expenses',
                },
            ]);

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            // Output should be NDJSON (one JSON object per line)
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(2);

            const tx1 = JSON.parse(lines[0]);
            const tx2 = JSON.parse(lines[1]);
            expect(tx1.description).to.equal('Stdin JSON tx 1');
            expect(tx2.description).to.equal('Stdin JSON tx 2');
        });

        it('should create a single transaction from JSON object', async function () {
            const jsonInput = JSON.stringify({
                date: '2025-03-03',
                amount: '50',
                description: 'Stdin single JSON tx',
                creditAccount: 'Revenue',
                debitAccount: 'Cash',
            });

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(1);

            const tx = JSON.parse(lines[0]);
            expect(tx.description).to.equal('Stdin single JSON tx');
        });
    });

    describe('CSV stdin', function () {
        it('should create transactions from CSV', async function () {
            const csvInput = [
                'date,amount,description,creditAccount,debitAccount',
                '2025-03-10,300,CSV tx 1,Revenue,Cash',
                '2025-03-11,400,CSV tx 2,Cash,Expenses',
            ].join('\n');

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                csvInput
            );

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(2);

            const tx1 = JSON.parse(lines[0]);
            const tx2 = JSON.parse(lines[1]);
            expect(tx1.description).to.equal('CSV tx 1');
            expect(tx2.description).to.equal('CSV tx 2');
        });

        it('should handle CSV with quoted fields', async function () {
            const csvInput = [
                'date,amount,description,creditAccount,debitAccount',
                '2025-03-12,150,"Quoted, description",Revenue,Cash',
            ].join('\n');

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                csvInput
            );

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(1);

            const tx = JSON.parse(lines[0]);
            expect(tx.description).to.equal('Quoted, description');
        });
    });

    describe('stdin with properties', function () {
        it('should create transactions with custom properties from JSON', async function () {
            const jsonInput = JSON.stringify([
                {
                    date: '2025-03-20',
                    amount: '75',
                    description: 'With props',
                    creditAccount: 'Revenue',
                    debitAccount: 'Cash',
                    invoice: 'INV-100',
                },
            ]);

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            const tx = JSON.parse(lines[0]);
            expect(tx.description).to.equal('With props');
            // The 'invoice' field should be mapped as a custom property
            expect(tx.properties).to.deep.include({ invoice: 'INV-100' });
        });
    });
});
