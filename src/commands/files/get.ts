import { File as BkperFile } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Retrieves a single file by ID from the specified book.
 *
 * The file content is hydrated before returning so CLI output can verify the
 * full upload cycle, not just metadata.
 *
 * @param bookId - The target book ID
 * @param fileId - File ID to look up
 * @returns The matching file
 * @throws Error if the file is not found
 */
export async function getFile(bookId: string, fileId: string): Promise<BkperFile> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const file = await book.getFile(fileId);
    if (!file) {
        throw new Error(`File not found: ${fileId}`);
    }

    await file.getContent();
    return file;
}
