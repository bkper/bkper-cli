import { program } from 'commander';
import type { OutputFormat } from '../render/output.js';

/**
 * Commander option collector for repeatable scalar flags.
 */
export function collectRepeatable(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

/**
 * Commander option collector for repeatable --property flags.
 */
export function collectProperty(value: string, previous: string[] | undefined): string[] {
    return collectRepeatable(value, previous);
}

/**
 * Commander option collector for repeatable --book flags.
 */
export function collectBook(value: string, previous: string[] | undefined): string[] {
    return collectRepeatable(value, previous);
}

/**
 * Commander parser for positive integer options such as pagination limits.
 */
export function parsePositiveInteger(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Value must be a positive integer');
    }
    return parsed;
}

/**
 * Returns the active output format, considering both --format and --json flags.
 * --json acts as a silent alias for --format json.
 */
export function getFormat(): OutputFormat {
    const opts = program.opts();
    if (opts.json === true) {
        return 'json';
    }
    const format = opts.format as string;
    if (format === 'json' || format === 'csv') {
        return format;
    }
    return 'table';
}
