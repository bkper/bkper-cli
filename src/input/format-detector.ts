export type InputFormat = 'json' | 'csv';

export function detectInputFormat(content: string): InputFormat {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    return 'csv';
}
