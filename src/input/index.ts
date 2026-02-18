export { readStdin } from './stdin-reader.js';

import { readStdin } from './stdin-reader.js';

/**
 * Parsed stdin result containing an array of JSON objects.
 */
export interface StdinItems {
    items: Record<string, unknown>[];
}

/**
 * Reads and parses JSON input from stdin.
 *
 * Accepts a single JSON object or a JSON array of objects.
 * Returns null if no piped input is available.
 *
 * @returns Parsed items, or null if stdin is not piped
 * @throws Error if input is not valid JSON or not an object/array
 */
export async function parseStdinItems(): Promise<StdinItems | null> {
    const content = await readStdin();
    if (content === null) {
        return null;
    }

    const parsed: unknown = JSON.parse(content);
    let items: Record<string, unknown>[];

    if (Array.isArray(parsed)) {
        items = parsed as Record<string, unknown>[];
    } else if (typeof parsed === 'object' && parsed !== null) {
        items = [parsed as Record<string, unknown>];
    } else {
        throw new Error('JSON input must be an object or an array of objects');
    }

    return { items };
}
