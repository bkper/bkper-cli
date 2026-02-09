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

describe('CLI - account commands', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        const bookName = uniqueTestName('test-accounts');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('account create', function () {
        it('should create an account with name and type', async function () {
            const result = await runBkperJson<bkper.Account>([
                'account',
                'create',
                bookId,
                '--name',
                'Cash',
                '--type',
                'ASSET',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Cash');
            expect(result.type).to.equal('ASSET');
        });

        it('should create an account with properties', async function () {
            const props = JSON.stringify({ code: '1001' });
            const result = await runBkperJson<bkper.Account>([
                'account',
                'create',
                bookId,
                '--name',
                'Bank',
                '--type',
                'ASSET',
                '--properties',
                props,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Bank');
            expect(result.properties).to.deep.include({ code: '1001' });
        });

        it('should create an account in a group', async function () {
            // First create the group
            await runBkperJson<bkper.Group>([
                'group',
                'create',
                bookId,
                '--name',
                'Current Assets',
            ]);

            const result = await runBkperJson<bkper.Account>([
                'account',
                'create',
                bookId,
                '--name',
                'Petty Cash',
                '--type',
                'ASSET',
                '--groups',
                'Current Assets',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Petty Cash');
        });
    });

    describe('account list', function () {
        it('should return an array of accounts', async function () {
            const result = await runBkperJson<bkper.Account[]>(['account', 'list', bookId]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThanOrEqual(3);

            const names = result.map(a => a.name);
            expect(names).to.include('Cash');
            expect(names).to.include('Bank');
            expect(names).to.include('Petty Cash');
        });
    });

    describe('account get', function () {
        it('should get an account by name', async function () {
            const result = await runBkperJson<bkper.Account>(['account', 'get', bookId, 'Cash']);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Cash');
            expect(result.type).to.equal('ASSET');
        });

        it('should fail for a non-existent account', async function () {
            const result = await runBkper(['account', 'get', bookId, 'NonExistent']);

            expect(result.exitCode).to.not.equal(0);
        });
    });

    describe('account update', function () {
        it('should update an account name', async function () {
            const result = await runBkperJson<bkper.Account>([
                'account',
                'update',
                bookId,
                'Cash',
                '--name',
                'Cash Updated',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('Cash Updated');
        });

        it('should update account properties', async function () {
            const props = JSON.stringify({ code: '1000' });
            const result = await runBkperJson<bkper.Account>([
                'account',
                'update',
                bookId,
                'Cash Updated',
                '--properties',
                props,
            ]);

            expect(result).to.be.an('object');
            expect(result.properties).to.deep.include({ code: '1000' });
        });
    });

    describe('account delete', function () {
        it('should delete an account', async function () {
            // Create a disposable account
            await runBkperJson<bkper.Account>([
                'account',
                'create',
                bookId,
                '--name',
                'ToDelete',
                '--type',
                'ASSET',
            ]);

            const result = await runBkperJson<bkper.Account>([
                'account',
                'delete',
                bookId,
                'ToDelete',
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal('ToDelete');

            // Verify it's gone
            const getResult = await runBkper(['account', 'get', bookId, 'ToDelete']);
            expect(getResult.exitCode).to.not.equal(0);
        });
    });
});
