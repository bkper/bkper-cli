/**
 * Quotes a value for display in copy-pasteable POSIX shell commands.
 *
 * @param value - Raw argument value
 * @returns A single-quoted shell argument
 */
export function quoteShellArg(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
