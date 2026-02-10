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

describe('CLI - book commands', function () {
    this.timeout(30000);

    let bookId: string;
    let bookName: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        bookName = uniqueTestName('test-book');
        bookId = await createTestBook(bookName);
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('book list', function () {
        it('should return an array of books', async function () {
            const result = await runBkperJson<bkper.Book[]>(['book', 'list']);

            expect(result).to.be.an('array');
            expect(result.length).to.be.greaterThan(0);
        });

        it('should find the test book by name query', async function () {
            const result = await runBkperJson<bkper.Book[]>(['book', 'list', '--query', bookName]);

            expect(result).to.be.an('array');
            const found = result.find(b => b.id === bookId);
            expect(found).to.exist;
            expect(found!.name).to.equal(bookName);
        });
    });

    describe('book get', function () {
        it('should return the test book by ID', async function () {
            const result = await runBkperJson<bkper.Book>(['book', 'get', bookId]);

            expect(result).to.be.an('object');
            expect(result.id).to.equal(bookId);
            expect(result.name).to.equal(bookName);
        });

        it('should fail for an invalid book ID', async function () {
            const result = await runBkper(['book', 'get', 'nonexistent-id']);

            expect(result.exitCode).to.not.equal(0);
        });
    });

    describe('book update', function () {
        it('should update the book name', async function () {
            const newName = uniqueTestName('updated-book');
            const result = await runBkperJson<bkper.Book>([
                'book',
                'update',
                bookId,
                '--name',
                newName,
            ]);

            expect(result).to.be.an('object');
            expect(result.name).to.equal(newName);

            // Update local reference for subsequent tests
            bookName = newName;
        });

        it('should update fraction digits', async function () {
            const result = await runBkperJson<bkper.Book>([
                'book',
                'update',
                bookId,
                '--fraction-digits',
                '4',
            ]);

            expect(result).to.be.an('object');
            expect(result.fractionDigits).to.equal(4);
        });

        it('should update decimal separator', async function () {
            const result = await runBkperJson<bkper.Book>([
                'book',
                'update',
                bookId,
                '--decimal-separator',
                'COMMA',
            ]);

            expect(result).to.be.an('object');
            expect(result.decimalSeparator).to.equal('COMMA');
        });

        it('should update properties', async function () {
            const result = await runBkperJson<bkper.Book>([
                'book',
                'update',
                bookId,
                '-p',
                'testKey=testValue',
            ]);

            expect(result).to.be.an('object');
            expect(result.properties).to.deep.include({ testkey: 'testValue' });
        });
    });
});
