/**
 * Maximum width for any single cell value.
 * Values exceeding this width are truncated with an ellipsis (…).
 * Header cells are never truncated.
 */
const MAX_CELL_WIDTH = 40;

/**
 * Truncates a string to maxWidth, appending '…' if it exceeds the limit.
 */
function truncateCell(value: string, maxWidth: number): string {
    if (value.length <= maxWidth) {
        return value;
    }
    return value.slice(0, maxWidth - 1) + '…';
}

/**
 * Formats a 2D matrix (row 0 = headers) into an aligned, human-readable table string.
 *
 * Output format:
 *   Name      Type      Parent
 *   ____________________________
 *   Revenue   INCOMING
 *   Expenses  OUTGOING
 *
 * @param matrix - 2D array where row 0 is headers and rows 1+ are data
 * @returns Formatted table string
 */
export function formatTable(matrix: unknown[][]): string {
    if (!matrix || matrix.length <= 1) {
        return '';
    }

    const COL_GAP = '  ';

    // Convert all cells to strings
    const rows = matrix.map((row, rowIndex) =>
        row.map(cell => {
            const str = cell == null ? '' : String(cell);
            // Don't truncate header row
            return rowIndex === 0 ? str : truncateCell(str, MAX_CELL_WIDTH);
        })
    );

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colCount = headers.length;

    // Calculate max width per column
    const colWidths: number[] = new Array(colCount).fill(0);
    for (const row of rows) {
        for (let i = 0; i < colCount; i++) {
            const cellLen = (row[i] || '').length;
            if (cellLen > colWidths[i]) {
                colWidths[i] = cellLen;
            }
        }
    }

    // Build a row string
    const formatRow = (row: string[]): string => {
        return row
            .map((cell, i) => {
                // Don't pad the last column
                if (i === colCount - 1) {
                    return cell;
                }
                return cell.padEnd(colWidths[i]);
            })
            .join(COL_GAP)
            .trimEnd();
    };

    const headerLine = formatRow(headers);
    const dividerLine = '_'.repeat(headerLine.length);

    const lines = [headerLine, dividerLine];
    for (const row of dataRows) {
        lines.push(formatRow(row));
    }

    return lines.join('\n');
}

/**
 * Formats a record as vertically aligned key-value pairs.
 *
 * Output format:
 *   name:      Checking
 *   type:      ASSET
 *   archived:  false
 *
 * @param item - Record to format
 * @returns Formatted key-value string
 */
export function formatItem(item: Record<string, unknown>): string {
    // Filter out null/undefined values
    const entries = Object.entries(item).filter(([, value]) => value != null);

    if (entries.length === 0) {
        return '';
    }

    // Find max key length for alignment
    const maxKeyLen = Math.max(...entries.map(([key]) => key.length));

    const lines = entries.map(([key, value]) => {
        const label = `${key}:`.padEnd(maxKeyLen + 2);
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${label}  ${displayValue}`;
    });

    return lines.join('\n');
}
