export { readStdin } from './stdin-reader.js';
export { InputFormat } from './format-detector.js';

import { readStdin } from './stdin-reader.js';
import { detectInputFormat, InputFormat } from './format-detector.js';
import { parseCsv } from './csv-parser.js';

/**
 * Value types supported in stdin items.
 * JSON input preserves native types (arrays, booleans, numbers as strings).
 * CSV input produces string values only.
 */
export type StdinValue = string | string[] | boolean;

export interface StdinItems {
    items: Record<string, StdinValue>[];
    format: InputFormat;
}

export async function parseStdinItems(): Promise<StdinItems | null> {
    const content = await readStdin();
    if (content === null) {
        return null;
    }

    const format = detectInputFormat(content);
    let items: Record<string, StdinValue>[];

    if (format === 'json') {
        const parsed: unknown = JSON.parse(content);
        if (Array.isArray(parsed)) {
            items = parsed as Record<string, StdinValue>[];
        } else if (typeof parsed === 'object' && parsed !== null) {
            items = [parsed as Record<string, StdinValue>];
        } else {
            throw new Error('JSON input must be an object or an array of objects');
        }
    } else {
        items = parseCsv(content);
    }

    return { items, format };
}
