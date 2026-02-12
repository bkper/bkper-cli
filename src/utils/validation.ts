/**
 * Validation utilities for collecting and reporting all errors at once.
 *
 * Instead of throwing on the first validation failure, commands should
 * collect all errors and throw a single {@link ValidationError} so
 * that users (and agents) can fix everything in one pass.
 */

/**
 * An error that carries multiple validation messages.
 *
 * The {@link message} property joins all individual errors with newlines
 * so it renders cleanly when printed by the CLI catch block.
 */
export class ValidationError extends Error {
    readonly errors: string[];

    constructor(errors: string[]) {
        const message =
            errors.length === 1
                ? errors[0]
                : 'Validation failed:\n' + errors.map(e => `  - ${e}`).join('\n');
        super(message);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

/**
 * Specification for a required option.
 *
 * @param name  - The option key as it appears in Commander's parsed `options`
 *                object (camelCase, e.g. "book" for `--book`).
 * @param flag  - The flag as the user types it (e.g. "--book", "--date").
 */
export interface RequiredOptionSpec {
    name: string;
    flag: string;
}

/**
 * Checks all required options and returns an array of error strings
 * for every option that is missing (`undefined` or `null`).
 */
export function validateRequiredOptions(
    options: Record<string, unknown>,
    specs: RequiredOptionSpec[]
): string[] {
    const errors: string[] = [];
    for (const spec of specs) {
        const value = options[spec.name];
        if (value === undefined || value === null) {
            errors.push(`Missing required option: ${spec.flag}`);
        }
    }
    return errors;
}

/**
 * Throws a {@link ValidationError} if the errors array is non-empty.
 */
export function throwIfErrors(errors: string[]): void {
    if (errors.length > 0) {
        throw new ValidationError(errors);
    }
}
