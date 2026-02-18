import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkperJson,
    runBkperWithStdin,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - account stdin', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-acct-stdin');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('JSON stdin', function () {
        it('should create accounts from JSON array', async function () {
            const jsonInput = JSON.stringify([
                { name: 'Stdin Cash', type: 'ASSET' },
                { name: 'Stdin Revenue', type: 'INCOMING' },
            ]);

            const result = await runBkperWithStdin(['account', 'create', '-b', bookId], jsonInput);

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(2);

            const acct1 = JSON.parse(lines[0]);
            const acct2 = JSON.parse(lines[1]);
            expect(acct1.name).to.equal('Stdin Cash');
            expect(acct2.name).to.equal('Stdin Revenue');
        });

        it('should create a single account from JSON object', async function () {
            const jsonInput = JSON.stringify({
                name: 'Stdin Expenses',
                type: 'OUTGOING',
            });

            const result = await runBkperWithStdin(['account', 'create', '-b', bookId], jsonInput);

            expect(result.exitCode).to.equal(0);
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            expect(lines.length).to.equal(1);

            const acct = JSON.parse(lines[0]);
            expect(acct.name).to.equal('Stdin Expenses');
            expect(acct.type).to.equal('OUTGOING');
        });
    });

    describe('verification', function () {
        it('should list all created accounts', async function () {
            const result = await runBkperJson<bkper.Account[]>(['account', 'list', '-b', bookId]);

            const names = result.map(a => a.name);
            expect(names).to.include('Stdin Cash');
            expect(names).to.include('Stdin Revenue');
            expect(names).to.include('Stdin Expenses');
        });
    });
});
