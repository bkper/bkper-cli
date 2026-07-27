import { expect, setupTestEnvironment } from '../../helpers/test-setup.js';
import { setMockBkper } from '../../helpers/mock-factory.js';
import type { MockBook, MockFile } from '../../helpers/mock-interfaces.js';
import { deleteFile } from '../../../../src/commands/files/delete.js';

describe('CLI - file delete Command', function () {
    let mockFile: MockFile;
    let mockBook: MockBook;
    let removeCalled: boolean;

    beforeEach(function () {
        setupTestEnvironment();
        removeCalled = false;

        mockFile = {
            getId: () => 'file-123',
            remove: async () => {
                removeCalled = true;
                return mockFile;
            },
            json: () => ({ id: 'file-123', name: 'receipt.pdf' }),
        };

        mockBook = {
            json: () => ({ id: 'book-123' }),
            getFile: async (id: string) => (id === 'not-found' ? undefined : mockFile),
        };

        setMockBkper({
            setConfig: () => {},
            getBook: async () => mockBook,
        });
    });

    it('should delete and return the file', async function () {
        const result = await deleteFile('book-123', 'file-123');

        expect(removeCalled).to.equal(true);
        expect(result).to.equal(mockFile);
    });

    it('should throw when file is not found', async function () {
        try {
            await deleteFile('book-123', 'not-found');
            expect.fail('Should have thrown');
        } catch (err: unknown) {
            expect((err as Error).message).to.equal('File not found: not-found');
        }
    });
});
