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
 * Checks whether a value is empty (null, undefined, empty array, or empty object).
 */
function isEmpty(value: unknown): boolean {
    if (value == null) return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value as Record<string, unknown>).length === 0
    )
        return true;
    return false;
}

/**
 * Checks whether a value is a primitive (not an object or array, or is null).
 */
function isPrimitive(value: unknown): boolean {
    return value === null || typeof value !== 'object';
}

/**
 * Renders key-value pairs of an object as aligned lines at the given indent level.
 *
 * - Primitive values are rendered inline: `key:  value`
 * - Nested objects get `key:` on its own line, then recursively indented content
 * - Arrays of primitives get `key:` then each item with `- ` prefix
 * - Arrays of objects get `key:` then each element as `- firstKey: value` block
 *
 * @param entries - Filtered [key, value] pairs to render
 * @param indent - Current indentation string (e.g., '', '  ', '    ')
 * @returns Array of formatted lines
 */
function formatEntries(entries: [string, unknown][], indent: string): string[] {
    const lines: string[] = [];

    // Find max key length for alignment at this indent level
    const maxKeyLen = Math.max(...entries.map(([key]) => key.length));

    for (const [key, value] of entries) {
        if (isPrimitive(value)) {
            const label = `${key}:`.padEnd(maxKeyLen + 2);
            lines.push(`${indent}${label}  ${String(value)}`);
        } else if (Array.isArray(value)) {
            lines.push(`${indent}${key}:`);
            const childIndent = indent + '  ';
            for (const element of value) {
                if (isPrimitive(element)) {
                    lines.push(`${childIndent}- ${String(element)}`);
                } else {
                    // Object element in array — render with `- ` prefix on first field
                    const objEntries = Object.entries(element as Record<string, unknown>).filter(
                        ([, v]) => !isEmpty(v)
                    );
                    if (objEntries.length === 0) continue;

                    // First field gets `- ` prefix
                    const [firstKey, firstValue] = objEntries[0];
                    const remainingEntries = objEntries.slice(1);

                    // Align keys within the array element block
                    const elementMaxKeyLen = Math.max(...objEntries.map(([k]) => k.length));
                    const firstLabel = `${firstKey}:`.padEnd(elementMaxKeyLen + 2);

                    if (isPrimitive(firstValue)) {
                        lines.push(`${childIndent}- ${firstLabel}  ${String(firstValue)}`);
                    } else {
                        lines.push(`${childIndent}- ${firstKey}:`);
                        // Indent nested value under the `- ` block
                        const nestedLines = formatNestedValue(firstValue, childIndent + '  ');
                        lines.push(...nestedLines);
                    }

                    // Remaining fields aligned under the `- ` prefix (indented by 2 more to match)
                    const fieldIndent = childIndent + '  ';
                    for (const [rKey, rValue] of remainingEntries) {
                        if (isEmpty(rValue)) continue;
                        if (isPrimitive(rValue)) {
                            const rLabel = `${rKey}:`.padEnd(elementMaxKeyLen + 2);
                            lines.push(`${fieldIndent}${rLabel}  ${String(rValue)}`);
                        } else {
                            lines.push(`${fieldIndent}${rKey}:`);
                            const nestedLines = formatNestedValue(rValue, fieldIndent + '  ');
                            lines.push(...nestedLines);
                        }
                    }
                }
            }
        } else {
            // Nested object
            lines.push(`${indent}${key}:`);
            const nestedLines = formatNestedValue(value, indent + '  ');
            lines.push(...nestedLines);
        }
    }

    return lines;
}

/**
 * Renders a nested value (object or array) at the given indent level.
 */
function formatNestedValue(value: unknown, indent: string): string[] {
    if (Array.isArray(value)) {
        const lines: string[] = [];
        for (const element of value) {
            if (isPrimitive(element)) {
                lines.push(`${indent}- ${String(element)}`);
            } else {
                const objEntries = Object.entries(element as Record<string, unknown>).filter(
                    ([, v]) => !isEmpty(v)
                );
                const nestedLines = formatEntries(objEntries, indent + '  ');
                if (nestedLines.length > 0) {
                    // Replace leading spaces of first line with `- ` prefix
                    nestedLines[0] = `${indent}- ${nestedLines[0].trimStart()}`;
                    lines.push(...nestedLines);
                }
            }
        }
        return lines;
    }

    const objEntries = Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => !isEmpty(v)
    );
    return formatEntries(objEntries, indent);
}

/**
 * Formats a record as vertically aligned key-value pairs with recursive
 * indented rendering for nested objects and arrays.
 *
 * Output format:
 *   name:        Checking
 *   type:        ASSET
 *   collection:
 *     id:        col-123
 *     name:      My Collection
 *   properties:
 *     key:       value
 *   tags:
 *     - tag1
 *     - tag2
 *
 * @param item - Record to format
 * @returns Formatted key-value string
 */
export function formatItem(item: Record<string, unknown>): string {
    // Filter out null/undefined and empty values
    const entries = Object.entries(item).filter(([, value]) => !isEmpty(value));

    if (entries.length === 0) {
        return '';
    }

    const lines = formatEntries(entries, '');
    return lines.join('\n');
}
