import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { File as BkperFile } from 'bkper-js';
import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import { ValidationError } from '../../../../src/utils/validation.js';
import { uploadFile } from '../../../../src/commands/files/upload.js';

describe('CLI - file upload Command', function () {
    let mockBook: any;
    let tempDir: string;
    let originalCreate: typeof BkperFile.prototype.create;

    before(function () {
        originalCreate = BkperFile.prototype.create;
    });

    afterEach(function () {
        BkperFile.prototype.create = originalCreate;
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    beforeEach(function () {
        setupTestEnvironment();
        tempDir = mkdtempSync(path.join(os.tmpdir(), 'bkper-file-upload-test-'));

        BkperFile.prototype.create = async function (this: BkperFile) {
            return this;
        };

        mockBook = {
            getId: () => 'book-123',
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

    it('should upload a local file successfully', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt-bytes');

        const result = await uploadFile('book-123', {
            path: filePath,
        });

        expect(result.json()).to.include({
            name: 'receipt.jpg',
            size: Buffer.byteLength('receipt-bytes'),
            contentType: 'image/jpeg',
        });
        expect(result.json().content).to.equal(Buffer.from('receipt-bytes').toString('base64'));
    });

    it('should infer contentType from the local file name', async function () {
        const filePath = path.join(tempDir, 'statement.pdf');
        writeFileSync(filePath, 'statement-bytes');

        const result = await uploadFile('book-123', {
            path: filePath,
            property: ['statement_period=2025-01', 'group_id=grp_123'],
        });

        expect(result.json().contentType).to.equal('application/pdf');
        expect(result.json().properties).to.deep.equal({
            statement_period: '2025-01',
            group_id: 'grp_123',
        });
    });

    it('should resolve --account by name and persist canonical account_id', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt');

        const result = await uploadFile('book-123', {
            path: filePath,
            account: 'Credit Card',
        });

        expect(result.json().properties).to.deep.equal({
            account_id: 'Credit Card-id',
        });
    });

    it('should resolve --account by id and persist canonical account_id', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt');

        mockBook.getAccount = async (nameOrId: string) => ({
            getId: () => 'acc_123',
            getName: () => nameOrId,
            json: () => ({ id: 'acc_123', name: nameOrId }),
        });

        const result = await uploadFile('book-123', {
            path: filePath,
            account: 'acc_123',
        });

        expect(result.json().properties).to.deep.equal({
            account_id: 'acc_123',
        });
    });

    it('should fail if account is not found', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt');
        mockBook.getAccount = async () => null;

        try {
            await uploadFile('book-123', {
                path: filePath,
                account: 'Missing Account',
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Account (--account) not found: Missing Account'
            );
        }
    });

    it('should fail if --account and raw account_id are combined', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt');

        try {
            await uploadFile('book-123', {
                path: filePath,
                account: 'Credit Card',
                property: ['account_id=acc_999'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Cannot combine --account with -p account_id=...'
            );
        }
    });

    it('should fail if upload_method property is provided', async function () {
        const filePath = path.join(tempDir, 'receipt.jpg');
        writeFileSync(filePath, 'receipt');

        try {
            await uploadFile('book-123', {
                path: filePath,
                property: ['upload_method=attachment'],
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors).to.include(
                'Property upload_method is reserved for transaction attachments and cannot be set with file upload'
            );
        }
    });

    it('should fail for a missing local file path', async function () {
        try {
            await uploadFile('book-123', {
                path: path.join(tempDir, 'missing.jpg'),
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include('Local file not found');
        }
    });

    it('should fail for a directory path', async function () {
        const directoryPath = path.join(tempDir, 'receipts');
        mkdirSync(directoryPath);

        try {
            await uploadFile('book-123', {
                path: directoryPath,
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
        writeFileSync(filePath, 'secret');
        chmodSync(filePath, 0o000);

        try {
            await uploadFile('book-123', {
                path: filePath,
            });
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect(err).to.be.instanceOf(ValidationError);
            expect((err as ValidationError).errors[0]).to.include(
                'Local file is not readable'
            );
        }
    });
});
