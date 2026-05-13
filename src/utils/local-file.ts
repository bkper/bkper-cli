import { readFile, stat } from 'node:fs/promises';
import mime from 'mime';
import path from 'node:path';

/**
 * Reads a local file from disk and returns a Bkper File payload.
 *
 * The payload preserves the local basename as the file name and encodes the
 * content as base64, ready to be passed to `new File(book, payload)`.
 *
 * @param localPath - Local filesystem path
 * @returns File payload suitable for Bkper uploads
 */
export async function readLocalFilePayload(localPath: string): Promise<bkper.File> {
    let fileStats;
    try {
        fileStats = await stat(localPath);
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            throw new Error(`Local file not found: ${localPath}`);
        }
        throw new Error(`Local file is not readable: ${localPath}`);
    }

    if (!fileStats.isFile()) {
        throw new Error(`Local path is not a regular file: ${localPath}`);
    }

    let content: Buffer;
    try {
        content = await readFile(localPath);
    } catch {
        throw new Error(`Local file is not readable: ${localPath}`);
    }

    const contentType = mime.getType(localPath);

    return {
        createdAt: `${Date.now()}`,
        name: path.basename(localPath),
        contentType: contentType || undefined,
        size: fileStats.size,
        content: content.toString('base64'),
    };
}
