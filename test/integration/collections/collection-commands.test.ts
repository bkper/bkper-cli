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

describe('CLI - collection commands', function () {
    this.timeout(30000);

    let bookId: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        bookId = await createTestBook(uniqueTestName('test-collection-book'));
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('collection lifecycle', function () {
        let collectionId: string;
        const collectionName = uniqueTestName('test-collection');

        it('should create a collection', async function () {
            const result = await runBkperJson<bkper.Collection>([
                'collection',
                'create',
                '--name',
                collectionName,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal(collectionName);
            expect(result.id).to.be.a('string');
            collectionId = result.id!;
        });

        it('should list collections and find the created one', async function () {
            const result = await runBkperJson<bkper.Collection[]>(['collection', 'list']);

            expect(result).to.be.an('array');
            const found = result.find(c => c.id === collectionId);
            expect(found).to.exist;
            expect(found!.name).to.equal(collectionName);
        });

        it('should get a collection by ID', async function () {
            const result = await runBkperJson<bkper.Collection>([
                'collection',
                'get',
                collectionId,
            ]);

            expect(result).to.be.an('object');
            expect(result.id).to.equal(collectionId);
            expect(result.name).to.equal(collectionName);
        });

        it('should fail to get a non-existent collection', async function () {
            const result = await runBkper(['collection', 'get', 'nonexistent-id']);

            expect(result.exitCode).to.not.equal(0);
        });

        it('should update a collection name', async function () {
            const newName = uniqueTestName('updated-collection');
            const result = await runBkperJson<bkper.Collection>([
                'collection',
                'update',
                collectionId,
                '--name',
                newName,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal(newName);
        });

        it('should add a book to the collection', async function () {
            const result = await runBkperJson<bkper.Book[]>([
                'collection',
                'add-book',
                collectionId,
                '-b',
                bookId,
            ]);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThan(0);
        });

        it('should remove a book from the collection', async function () {
            const result = await runBkperJson<bkper.Book[]>([
                'collection',
                'remove-book',
                collectionId,
                '-b',
                bookId,
            ]);

            expect(result).to.be.an('array');
        });

        it('should delete the collection', async function () {
            const result = await runBkper(['collection', 'delete', collectionId]);

            expect(result.exitCode).to.equal(0);
        });
    });

    describe('collection error handling', function () {
        it('should fail when missing required --name for create', async function () {
            const result = await runBkper(['collection', 'create']);

            expect(result.exitCode).to.not.equal(0);
        });
    });
});
