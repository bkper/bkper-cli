/**
 * Formats a field value according to RFC 4180 rules.
 *
 * - null/undefined become empty string
 * - Fields containing commas, double quotes, or newlines are wrapped in double quotes
 * - Double quotes within a field are escaped by doubling them ("")
 */
function formatField(value: unknown): string {
    if (value == null) {
        return '';
    }

    const str = String(value);

    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
}

/**
 * Formats a 2D matrix into an RFC 4180 compliant CSV string.
 *
 * - Row 0 is treated as headers, rows 1+ as data (all rendered identically)
 * - Uses CRLF line endings per RFC 4180
 * - Fields containing commas, double quotes, or newlines are quoted
 * - Double quotes are escaped by doubling them ("")
 * - null/undefined cells are rendered as empty strings
 * - No truncation is applied to any field
 *
 * @param matrix - 2D array where row 0 is headers and rows 1+ are data
 * @returns RFC 4180 CSV string
 */
export function formatCsv(matrix: unknown[][]): string {
    if (!matrix || matrix.length === 0) {
        return '';
    }

    return matrix.map(row => row.map(formatField).join(',')).join('\r\n');
}
