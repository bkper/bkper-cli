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
        it('should create groups from JSON array', async function () {
            const jsonInput = JSON.stringify([
                { name: 'Stdin Group A' },
                { name: 'Stdin Group B' },
            ]);

            const result = await runBkperWithStdin(['group', 'create', '-b', bookId], jsonInput);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(2);
            expect(parsed[0].name).to.equal('Stdin Group A');
            expect(parsed[1].name).to.equal('Stdin Group B');
        });

        it('should create a single group from JSON object', async function () {
            const jsonInput = JSON.stringify({ name: 'Stdin Group C' });

            const result = await runBkperWithStdin(['group', 'create', '-b', bookId], jsonInput);

            expect(result.exitCode).to.equal(0);
            const parsed = JSON.parse(result.stdout);
            expect(parsed).to.be.an('array').with.length(1);
            expect(parsed[0].name).to.equal('Stdin Group C');
        });
    });

    describe('verification', function () {
        it('should list all created groups', async function () {
            const result = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookId]);

            const names = result.map(g => g.name);
            expect(names).to.include('Stdin Group A');
            expect(names).to.include('Stdin Group B');
            expect(names).to.include('Stdin Group C');
        });
    });
});
