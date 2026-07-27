import { File as BkperFile } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';

/**
 * Deletes a file from the specified book.
 *
 * @param bookId - The ID of the book containing the file
 * @param fileId - The ID of the file to delete
 * @returns The removed file
 */
export async function deleteFile(bookId: string, fileId: string): Promise<BkperFile> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);
    const file = await book.getFile(fileId);
    if (!file) {
        throw new Error(`File not found: ${fileId}`);
    }

    return file.remove();
}
