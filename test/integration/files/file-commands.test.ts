import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import {
    isApiAvailable,
    getApiUrl,
    createTestBook,
    deleteTestBook,
    runBkperJson,
    uniqueTestName,
} from '../helpers/api-helpers.js';

describe('CLI - file commands', function () {
    this.timeout(120000);

    let bookId: string;
    let tempDir: string;

    before(async function () {
        const available = await isApiAvailable();
        if (!available) {
            console.log(`    Skipping: API not available at ${getApiUrl()}`);
            this.skip();
        }

        tempDir = mkdtempSync(path.join(os.tmpdir(), 'bkper-file-integration-'));

        const bookName = uniqueTestName('test-files');
        bookId = await createTestBook(bookName);

        await runBkperJson([
            'account',
            'create',
            '-b',
            bookId,
            '--name',
            'Credit Card',
            '--type',
            'LIABILITY',
        ]);
    });

    after(function () {
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    after(async function () {
        if (bookId) {
            await deleteTestBook(bookId);
        }
    });

    describe('file upload', function () {
        it('should upload a file and retrieve it with the expected metadata and content', async function () {
            const filePath = path.join(tempDir, 'statement.pdf');
            const fileContent = '%PDF-1.4\nstatement-content\n%%EOF';
            writeFileSync(filePath, fileContent);

            const uploaded = await runBkperJson<bkper.File>([
                'file',
                'upload',
                filePath,
                '-b',
                bookId,
                '-p',
                'statement_period=2025-01',
            ]);

            expect(uploaded).to.be.an('object');
            expect(uploaded.id).to.be.a('string');
            expect(uploaded.name).to.equal('statement.pdf');
            expect(uploaded.contentType).to.equal('application/pdf');
            expect(uploaded.properties).to.deep.include({ statement_period: '2025-01' });

            const retrieved = await runBkperJson<bkper.File>([
                'file',
                'get',
                uploaded.id!,
                '-b',
                bookId,
            ]);

            expect(retrieved.id).to.equal(uploaded.id);
            expect(retrieved.name).to.equal('statement.pdf');
            expect(retrieved.contentType).to.equal('application/pdf');
            expect(retrieved.content).to.equal(Buffer.from(fileContent).toString('base64'));
        });

        it('should set resolved account_id when --account is used and keep it on retrieval', async function () {
            const filePath = path.join(tempDir, 'receipt.pdf');
            const fileContent = '%PDF-1.4\nreceipt-content\n%%EOF';
            writeFileSync(filePath, fileContent);

            const uploaded = await runBkperJson<bkper.File>([
                'file',
                'upload',
                filePath,
                '-b',
                bookId,
                '--account',
                'Credit Card',
            ]);

            expect(uploaded).to.be.an('object');
            expect(uploaded.properties).to.have.property('account_id');
            expect(uploaded.properties?.account_id).to.be.a('string');
            expect(uploaded.contentType).to.equal('application/pdf');

            const retrieved = await runBkperJson<bkper.File>([
                'file',
                'get',
                uploaded.id!,
                '-b',
                bookId,
            ]);

            expect(retrieved.id).to.equal(uploaded.id);
            expect(retrieved.properties?.account_id).to.equal(uploaded.properties?.account_id);
            expect(retrieved.contentType).to.equal('application/pdf');
            expect(retrieved.content).to.equal(Buffer.from(fileContent).toString('base64'));
        });
    });
});
