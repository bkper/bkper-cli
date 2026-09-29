/**
 * JSON-only output rendering.
 *
 * Contract:
 * - stdout carries only the JSON result, so it is always parseable (e.g. by jq).
 * - Lists use a stable `{"items":[...]}` envelope, adding `"cursor"` only when a
 *   next page exists. Each record is compact on its own line.
 * - Matrices (balance reports) are bare 2D arrays with one row per line.
 * - Single items are pretty-printed only on an interactive terminal.
 * - Hints, notices, and warnings go to stderr.
 */

/**
 * Structured list result returned by list commands.
 */
export interface ListResult {
    items: unknown[];
    /** Cursor for the next page, present only when more results exist. */
    cursor?: string;
    /** Human/agent guidance (e.g. next-page command), written to stderr. */
    hint?: string;
}

/**
 * Serializes lines as a JSON array body with one entry per line.
 */
function formatLines(lines: string[]): string {
    return lines.length > 0 ? `[\n${lines.join(',\n')}\n]` : '[]';
}

/**
 * Formats list items in the `{"items":[...]}` envelope, one record per line.
 */
export function formatList(items: unknown[], cursor?: string): string {
    const body = formatLines(items.map(item => JSON.stringify(item)));
    const cursorPart = cursor !== undefined ? `,"cursor":${JSON.stringify(cursor)}` : '';
    return `{"items":${body}${cursorPart}}`;
}

/**
 * Formats a 2D matrix as JSON, one row per line.
 */
export function formatMatrix(matrix: unknown[][]): string {
    return formatLines(matrix.map(row => JSON.stringify(row)));
}

/**
 * Formats a single item as pretty (2-space) or compact JSON.
 */
export function formatItem(item: object, pretty: boolean): string {
    return pretty ? JSON.stringify(item, null, 2) : JSON.stringify(item);
}

/**
 * Whether stdout is an interactive terminal (a human is reading).
 */
export function isInteractiveOutput(): boolean {
    return process.stdout.isTTY === true;
}

/**
 * Renders a list result: JSON to stdout, hint to stderr.
 */
export function renderList(result: ListResult): void {
    console.log(formatList(result.items, result.cursor));
    if (result.hint) {
        console.error(result.hint);
    }
}

/**
 * Renders a 2D matrix as JSON to stdout.
 */
export function renderMatrix(matrix: unknown[][]): void {
    console.log(formatMatrix(matrix));
}

/**
 * Renders a single item as JSON to stdout.
 *
 * @param item - Record to render
 * @param pretty - Pretty-print; defaults to true only on an interactive terminal
 */
export function renderItem(item: object, pretty = isInteractiveOutput()): void {
    console.log(formatItem(item, pretty));
}

/**
 * Renders a human-readable notice (e.g. success without a result) to stderr.
 */
export function renderNotice(message: string): void {
    console.error(message);
}
