import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkper,
    runBkperWithStdin,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - pipeline (end-to-end)', function () {
    this.timeout(60000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-pipeline');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    it('should create accounts, then transactions via stdin, then list in CSV', async function () {
        // Step 1: Create accounts via stdin (JSON)
        const accountsJson = JSON.stringify([
            { name: 'Pipeline Cash', type: 'ASSET' },
            { name: 'Pipeline Revenue', type: 'INCOMING' },
            { name: 'Pipeline Expenses', type: 'OUTGOING' },
        ]);

        const acctResult = await runBkperWithStdin(
            ['account', 'create', '-b', bookId],
            accountsJson
        );
        expect(acctResult.exitCode).to.equal(0);

        const acctLines = acctResult.stdout.trim().split('\n').filter(Boolean);
        expect(acctLines.length).to.equal(3);

        // Step 2: Create transactions via stdin (CSV)
        const txCsv = [
            'date,amount,description,from,to',
            '2025-04-01,1000,Monthly sale,Pipeline Revenue,Pipeline Cash',
            '2025-04-02,200,Office supplies,Pipeline Cash,Pipeline Expenses',
            '2025-04-03,500,Consulting fee,Pipeline Revenue,Pipeline Cash',
        ].join('\n');

        const txResult = await runBkperWithStdin(['transaction', 'create', '-b', bookId], txCsv);
        expect(txResult.exitCode).to.equal(0);

        const txLines = txResult.stdout.trim().split('\n').filter(Boolean);
        expect(txLines.length).to.equal(3);

        // Verify each transaction has expected fields
        const createdTransactions: Array<{ id: string; amount: string; description: string }> = [];
        for (const line of txLines) {
            const tx = JSON.parse(line);
            expect(tx).to.have.property('id');
            expect(tx).to.have.property('amount');
            createdTransactions.push(tx);
        }

        // Step 3: List accounts in CSV format
        const csvResult = await runBkper(['--format', 'csv', 'account', 'list', '-b', bookId]);

        expect(csvResult.exitCode).to.equal(0);
        const csvLines = csvResult.stdout.trim().split(/\r?\n/);
        // Header + at least 3 accounts
        expect(csvLines.length).to.be.greaterThanOrEqual(4);
        expect(csvLines[0]).to.contain('Name');

        // Step 4: Verify transaction data from creation output
        const descriptions = createdTransactions.map(t => t.description);
        expect(descriptions).to.include('Monthly sale');
        expect(descriptions).to.include('Office supplies');
        expect(descriptions).to.include('Consulting fee');

        const amounts = createdTransactions.map(t => t.amount);
        expect(amounts).to.include('1000');
        expect(amounts).to.include('200');
        expect(amounts).to.include('500');
    });

    it('should handle mixed format workflow: create via JSON, list as CSV', async function () {
        // Create a group via JSON stdin
        const groupResult = await runBkperWithStdin(
            ['group', 'create', '-b', bookId],
            JSON.stringify({ name: 'Pipeline Group' })
        );
        expect(groupResult.exitCode).to.equal(0);

        // List groups in CSV
        const csvResult = await runBkper(['--format', 'csv', 'group', 'list', '-b', bookId]);

        expect(csvResult.exitCode).to.equal(0);
        const lines = csvResult.stdout.trim().split(/\r?\n/);
        expect(lines.length).to.be.greaterThanOrEqual(2); // header + data
        expect(lines[0]).to.contain('Name');

        // Verify the group appears in the CSV
        const dataLines = lines.slice(1).join('\n');
        expect(dataLines).to.contain('Pipeline Group');
    });
});
