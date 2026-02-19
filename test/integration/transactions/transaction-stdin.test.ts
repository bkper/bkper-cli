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
                    creditAccount: { name: 'Revenue' },
                    debitAccount: { name: 'Cash' },
                },
                {
                    date: '2025-03-02',
                    amount: '200',
                    description: 'Stdin JSON tx 2',
                    creditAccount: { name: 'Cash' },
                    debitAccount: { name: 'Expenses' },
                },
            ]);

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            // Output should be a flat JSON array
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(2);
            expect(parsed[0].description).to.equal('Stdin JSON tx 1');
            expect(parsed[1].description).to.equal('Stdin JSON tx 2');
        });

        it('should create a single transaction from JSON object', async function () {
            const jsonInput = JSON.stringify({
                date: '2025-03-03',
                amount: '50',
                description: 'Stdin single JSON tx',
                creditAccount: { name: 'Revenue' },
                debitAccount: { name: 'Cash' },
            });

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(1);
            expect(parsed[0].description).to.equal('Stdin single JSON tx');
        });
    });

    describe('stdin with properties', function () {
        it('should create transactions with custom properties from JSON', async function () {
            const jsonInput = JSON.stringify([
                {
                    date: '2025-03-20',
                    amount: '75',
                    description: 'With props',
                    creditAccount: { name: 'Revenue' },
                    debitAccount: { name: 'Cash' },
                    properties: { invoice: 'INV-100' },
                },
            ]);

            const result = await runBkperWithStdin(
                ['transaction', 'create', '-b', bookId],
                jsonInput
            );

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(1);
            expect(parsed[0].description).to.equal('With props');
            expect(parsed[0].properties).to.deep.include({ invoice: 'INV-100' });
        });
    });
});
