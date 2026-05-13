import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';

// Import after mock setup
const { getFile } = await import('../../../../src/commands/files/get.js');

describe('CLI - file get Command', function () {
    let mockBook: any;
    let mockFile: any;

    beforeEach(function () {
        setupTestEnvironment();

        mockFile = {
            getId: () => 'file-123',
            getName: () => 'receipt.pdf',
            getContentType: () => 'application/pdf',
            getContent: async () => 'cmVjZWlwdC1ieXRlcw==',
            json: () => ({
                id: 'file-123',
                name: 'receipt.pdf',
                contentType: 'application/pdf',
                content: 'cmVjZWlwdC1ieXRlcw==',
            }),
        };

        mockBook = {
            getFile: async (id: string) => {
                if (id === 'not-found') return undefined;
                return mockFile;
            },
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should return file by id', async function () {
        const result = await getFile('book-123', 'file-123');
        expect(result).to.equal(mockFile);
    });

    it('should hydrate file content before returning', async function () {
        let getContentCalled = false;
        mockFile.getContent = async () => {
            getContentCalled = true;
            return 'cmVjZWlwdA==';
        };

        const result = await getFile('book-123', 'file-123');

        expect(result).to.equal(mockFile);
        expect(getContentCalled).to.equal(true);
    });

    it('should throw when file not found', async function () {
        try {
            await getFile('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.include('File not found');
            expect((err as Error).message).to.include('not-found');
        }
    });
});
