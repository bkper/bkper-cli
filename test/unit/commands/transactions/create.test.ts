import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Transaction } from 'bkper-js';
import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';

// Import after mock setup
const { createTransaction, resolveCreateTransactionFilePath } = await import(
    '../../../../src/commands/transactions/create.js'
);

describe('CLI - transaction create Command', function () {
    let mockBook: any;
    let tempDir: string;
    let originalCreate: typeof Transaction.prototype.create;

    before(function () {
        originalCreate = Transaction.prototype.create;
    });

    afterEach(function () {
        Transaction.prototype.create = originalCreate;
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    beforeEach(function () {
        setupTestEnvironment();
        tempDir = mkdtempSync(path.join(os.tmpdir(), 'bkper-transaction-file-test-'));

        mockBook = {
            getId: () => 'book-123',
            json: () => ({ id: 'book-123', name: 'Test Book' }),
            getDecimalSeparator: () => 'DOT',
            getFractionDigits: () => 2,
            getDatePattern: () => 'yyyy-MM-dd',
            getTimeZone: () => 'UTC',
            getTimeZoneOffset: () => 0,
            getAccount: async (nameOrId: string) => ({
                getId: () => `${nameOrId}-id`,
                getName: () => nameOrId,
                json: () => ({ id: `${nameOrId}-id`, name: nameOrId }),
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should create a transaction with description only', async function () {
        let createCalled = false;
        Transaction.prototype.create = async function (this: Transaction) {
            createCalled = true;
            return this;
        };

        const result = await createTransaction('book-123', {
            description: 'Office supplies',
        });

        expect(createCalled).to.be.true;
        expect(result).to.exist;
    });

    it('should attach one local file before create', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt-data');

        Transaction.prototype.create = async function (this: Transaction) {
            return this;
        };

        const result = await createTransaction('book-123', {
            description: 'Office supplies',
            file: filePath,
        });

        expect(result.json().files).to.have.length(1);
        expect(result.json().files?.[0].name).to.equal('receipt.jpg');
        expect(result.json().files?.[0].contentType).to.equal('image/jpeg');
        expect(result.json().files?.[0].content).to.equal(
            Buffer.from('receipt-data').toString('base64')
        );
    });

    it('should allow file-only draft create', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt-data');

        Transaction.prototype.create = async function (this: Transaction) {
            return this;
        };

        const result = await createTransaction('book-123', {
            file: filePath,
        });

        expect(result).to.exist;
        expect(result.json().files).to.have.length(1);
        expect(result.json().files?.[0].name).to.equal('receipt.jpg');
        expect(result.json().files?.[0].contentType).to.equal('image/jpeg');
    });

    it('should throw when credit account (from) not found', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'NonExistent',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Credit account (--from) not found: NonExistent'
            );
        }
    });

    it('should report all not-found accounts at once', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'BadSource',
                to: 'BadDest',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('BadSource');
            expect(ve.errors[1]).to.include('BadDest');
        }
    });

    it('should report not-found accounts and invalid properties together', async function () {
        mockBook.getAccount = async () => null;

        try {
            await createTransaction('book-123', {
                date: '2024-01-15',
                amount: '100',
                from: 'Missing',
                property: ['invalidprop'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            const ve = err as ValidationError;
            expect(ve.errors).to.have.length(2);
            expect(ve.errors[0]).to.include('Missing');
            expect(ve.errors[1]).to.include('Invalid property format');
        }
    });

    it('should fail for a missing local file path', async function () {
        try {
            await createTransaction('book-123', {
                description: 'Missing file',
                file: path.join(tempDir, 'missing.jpg'),
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include('Local file not found');
        }
    });

    it('should fail for a directory local file path', async function () {
        const directoryPath = path.join(tempDir, 'receipts');
        mkdirSync(directoryPath);

        try {
            await createTransaction('book-123', {
                description: 'Directory file',
                file: directoryPath,
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include(
                'Local path is not a regular file'
            );
        }
    });

    it('should fail for an unreadable local file path', async function () {
        const filePath = path.join(tempDir, 'secret.jpg');
        writeFileSync(filePath, 'secret-data');
        chmodSync(filePath, 0o000);

        try {
            await createTransaction('book-123', {
                description: 'Unreadable file',
                file: filePath,
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include(
                'Local file is not readable'
            );
        }
    });

    it('should reject repeated --file option values', function () {
        try {
            resolveCreateTransactionFilePath(['one.jpg', 'two.jpg'], false);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Option --file may only be provided once'
            );
        }
    });

    it('should reject stdin input together with --file', function () {
        try {
            resolveCreateTransactionFilePath(['receipt.jpg'], true);
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Option --file is only supported for single transaction create and cannot be used with stdin input'
            );
        }
    });
});
