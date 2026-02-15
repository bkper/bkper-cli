/**
 * Supported input formats for piped data.
 */
export type InputFormat = 'json' | 'csv';

/**
 * Detects whether the input content is JSON or CSV based on the first non-whitespace character.
 *
 * @param content - The raw input string to analyze
 * @returns The detected input format
 */
export function detectInputFormat(content: string): InputFormat {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    return 'csv';
}
