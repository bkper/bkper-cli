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

describe('CLI - group commands', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-groups');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('group create', function () {
        it('should create a group', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'create',
                '-b',
                bookId,
                '--name',
                'Assets',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Assets');
        });

        it('should create a child group with parent', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'create',
                '-b',
                bookId,
                '--name',
                'Current Assets',
                '--parent',
                'Assets',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Current Assets');
        });

        it('should create a hidden group', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'create',
                '-b',
                bookId,
                '--name',
                'Internal',
                '--hidden',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Internal');
            expect(result.hidden).to.equal(true);
        });

        it('should create a group with properties', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'create',
                '-b',
                bookId,
                '--name',
                'Expenses',
                '-p',
                'code=GRP-001',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Expenses');
            expect(result.properties).to.deep.include({ code: 'GRP-001' });
        });
    });

    describe('group list', function () {
        it('should return an array of groups', async function () {
            const result = await runBkperJson<bkper.Group[]>(['group', 'list', '-b', bookId]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThanOrEqual(4);

            const names = result.map(g => g.name);
            expect(names).to.include('Assets');
            expect(names).to.include('Current Assets');
            expect(names).to.include('Internal');
            expect(names).to.include('Expenses');
        });
    });

    describe('group get', function () {
        it('should get a group by name', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'get',
                'Assets',
                '-b',
                bookId,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Assets');
        });

        it('should fail for a non-existent group', async function () {
            const result = await runBkper(['group', 'get', 'NonExistent', '-b', bookId]);

            expect(result.exitCode).to.not.equal(0);
        });
    });

    describe('group update', function () {
        it('should update a group name', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'update',
                'Expenses',
                '-b',
                bookId,
                '--name',
                'Operating Expenses',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Operating Expenses');
        });

        it('should update group properties', async function () {
            const result = await runBkperJson<bkper.Group>([
                'group',
                'update',
                'Operating Expenses',
                '-b',
                bookId,
                '-p',
                'code=GRP-002',
            ]);

            expect(result).to.be.an('object');
            expect(result.properties).to.deep.include({ code: 'GRP-002' });
        });
    });

    describe('group delete', function () {
        it('should delete a group', async function () {
            // Create a disposable group
            await runBkperJson<bkper.Group>([
                'group',
                'create',
                '-b',
                bookId,
                '--name',
                'ToDelete',
            ]);

            const result = await runBkperJson<bkper.Group>([
                'group',
                'delete',
                'ToDelete',
                '-b',
                bookId,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('ToDelete');

            // Verify it's gone
            const getResult = await runBkper(['group', 'get', 'ToDelete', '-b', bookId]);
            expect(getResult.exitCode).to.not.equal(0);
        });
    });
});
