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

describe('CLI - group stdin', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-grp-stdin');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('JSON stdin', function () {
        it('should reject group creation from JSON stdin', async function () {
            const jsonInput = JSON.stringify([
                { name: 'Stdin Group A' },
                { name: 'Stdin Group B' },
            ]);

            const result = await runBkperWithStdin(['group', 'create', '-b', bookId], jsonInput);

            expect(result.exitCode).to.not.equal(0);
            expect(result.stderr).to.include('Missing required option: --name');
        });
    });

    describe('verification', function () {
        it('should not create groups from stdin input', async function () {
            const result = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookId]);

            const names = result.map(g => g.name);
            expect(names).to.not.include('Stdin Group A');
            expect(names).to.not.include('Stdin Group B');
            expect(names).to.not.include('Stdin Group C');
        });
    });
});
