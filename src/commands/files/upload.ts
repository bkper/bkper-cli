import { File as BkperFile } from 'bkper-js';
import { getBkperInstance } from '../../bkper-factory.js';
import { parsePropertyFlag } from '../../utils/properties.js';
import { readLocalFilePayload } from '../../utils/local-file.js';
import { throwIfErrors } from '../../utils/validation.js';

const ACCOUNT_ID_PROPERTY = 'account_id';
const UPLOAD_METHOD_PROPERTY = 'upload_method';

/**
 * Options for uploading a local file to a book.
 */
export interface UploadFileOptions {
    path: string;
    account?: string;
    property?: string[];
}

/**
 * Uploads a local file to a book.
 *
 * @param bookId - Target book ID
 * @param options - Upload options including local path and optional properties
 * @returns The created file resource
 */
export async function uploadFile(
    bookId: string,
    options: UploadFileOptions
): Promise<BkperFile> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    const errors: string[] = [];
    let payload: bkper.File | undefined;

    try {
        payload = await readLocalFilePayload(options.path);
    } catch (err: unknown) {
        errors.push((err as Error).message);
    }

    const parsedProperties: Array<[string, string]> = [];
    let hasRawAccountId = false;

    if (options.property) {
        for (const raw of options.property) {
            try {
                const [key, value] = parsePropertyFlag(raw);
                if (key === UPLOAD_METHOD_PROPERTY) {
                    errors.push(
                        'Property upload_method is reserved for transaction attachments and cannot be set with file upload'
                    );
                    continue;
                }
                if (key === ACCOUNT_ID_PROPERTY) {
                    hasRawAccountId = true;
                }
                parsedProperties.push([key, value]);
            } catch (err: unknown) {
                errors.push((err as Error).message);
            }
        }
    }

    if (options.account && hasRawAccountId) {
        errors.push('Cannot combine --account with -p account_id=...');
    }

    let resolvedAccountId: string | undefined;
    if (options.account) {
        const account = await book.getAccount(options.account);
        if (!account) {
            errors.push(`Account (--account) not found: ${options.account}`);
        } else {
            const accountId = account.getId();
            if (!accountId) {
                errors.push(`Resolved account (--account) is missing an id: ${options.account}`);
            } else {
                resolvedAccountId = accountId;
            }
        }
    }

    throwIfErrors(errors);

    if (!payload) {
        throw new Error(`Unable to load local file payload: ${options.path}`);
    }

    const file = new BkperFile(book, payload);

    for (const [key, value] of parsedProperties) {
        if (value === '') {
            file.deleteProperty(key);
        } else {
            file.setProperty(key, value);
        }
    }

    if (resolvedAccountId) {
        file.setProperty(ACCOUNT_ID_PROPERTY, resolvedAccountId);
    }

    return file.create();
}
