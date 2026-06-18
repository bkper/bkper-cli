import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

const { DEFAULT_FILE_LIST_LIMIT, listFiles, listFilesFormatted } = await import(
    '../../../../src/commands/files/list.js'
);

describe('CLI - file list Command', function () {
    let mockBook: any;

    beforeEach(function () {
        setupTestEnvironment();
    });

    it('should list one page of files with default limit', async function () {
        let capturedLimit: number | undefined;
        let capturedCursor: string | undefined;
        const mockFiles = [
            {
                getId: () => 'file-1',
                json: () => ({ id: 'file-1', name: 'receipt.pdf' }),
            },
        ];

        mockBook = {
            listFiles: async (limit?: number, cursor?: string) => {
                capturedLimit = limit;
                capturedCursor = cursor;
                return {
                    getItems: () => mockFiles,
                    getCursor: () => 'next-cursor',
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listFiles('book-123', {});

        expect(capturedLimit).to.equal(DEFAULT_FILE_LIST_LIMIT);
        expect(capturedCursor).to.equal(undefined);
        expect(result.items).to.equal(mockFiles);
        expect(result.cursor).to.equal('next-cursor');
    });

    it('should pass cursor and custom limit to book.listFiles', async function () {
        let capturedLimit: number | undefined;
        let capturedCursor: string | undefined;

        mockBook = {
            listFiles: async (limit?: number, cursor?: string) => {
                capturedLimit = limit;
                capturedCursor = cursor;
                return {
                    getItems: () => [],
                    getCursor: () => undefined,
                };
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        await listFiles('book-123', { limit: 25, cursor: 'page-2' });

        expect(capturedLimit).to.equal(25);
        expect(capturedCursor).to.equal('page-2');
    });

    it('should return JSON formatted files in an items envelope without content', async function () {
        mockBook = {
            listFiles: async () => ({
                getItems: () => [
                    {
                        getId: () => 'file-1',
                        json: () => ({
                            id: 'file-1',
                            name: 'receipt.pdf',
                            contentType: 'application/pdf',
                            content: 'base64-content',
                        }),
                    },
                ],
                getCursor: () => 'next-cursor',
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listFilesFormatted('book-123', {}, 'json');

        expect(result).to.deep.equal({
            kind: 'json',
            items: [
                {
                    id: 'file-1',
                    name: 'receipt.pdf',
                    contentType: 'application/pdf',
                },
            ],
            cursor: 'next-cursor',
        });
    });

    it('should include a next page command footer for table output when cursor is present', async function () {
        mockBook = {
            listFiles: async () => ({
                getItems: () => [
                    {
                        getId: () => 'file-1',
                        json: () => ({ id: 'file-1', name: 'receipt.pdf' }),
                    },
                ],
                getCursor: () => 'next-cursor',
            }),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });

        const result = await listFilesFormatted('book-123', {}, 'table');

        expect(result.kind).to.equal('matrix');
        if (result.kind !== 'matrix') {
            throw new Error('Expected matrix list result');
        }
        expect(result.footer).to.contain('Next cursor: next-cursor');
        expect(result.footer).to.contain(
            "Next page: bkper file list -b 'book-123' --limit 100 --cursor 'next-cursor'"
        );
    });
});
