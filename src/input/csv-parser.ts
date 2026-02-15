export function parseCsv(content: string): Record<string, string>[] {
    const rows = parseRows(content);
    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0].map(h => h.trim());
    const results: Record<string, string>[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 1 && row[0] === '') {
            continue;
        }

        const record: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
            record[headers[j]] = j < row.length ? row[j] : '';
        }
        results.push(record);
    }

    return results;
}

function parseRows(content: string): string[][] {
    const rows: string[][] = [];
    let current = 0;

    while (current < content.length) {
        const { fields, nextPosition } = parseRow(content, current);
        rows.push(fields);
        current = nextPosition;
    }

    return rows;
}

function parseRow(content: string, start: number): { fields: string[]; nextPosition: number } {
    const fields: string[] = [];
    let pos = start;

    while (pos < content.length) {
        if (content[pos] === '"') {
            const { value, nextPosition } = parseQuotedField(content, pos);
            fields.push(value);
            pos = nextPosition;
        } else {
            const { value, nextPosition } = parseUnquotedField(content, pos);
            fields.push(value);
            pos = nextPosition;
        }

        if (pos >= content.length) {
            break;
        }

        if (content[pos] === ',') {
            pos++;
            if (
                pos >= content.length ||
                content[pos] === '\n' ||
                (content[pos] === '\r' && content[pos + 1] === '\n')
            ) {
                fields.push('');
                break;
            }
            continue;
        }

        if (content[pos] === '\r' && pos + 1 < content.length && content[pos + 1] === '\n') {
            pos += 2;
            break;
        }

        if (content[pos] === '\n') {
            pos++;
            break;
        }
    }

    return { fields, nextPosition: pos };
}

function parseQuotedField(content: string, start: number): { value: string; nextPosition: number } {
    let pos = start + 1;
    const chars: string[] = [];

    while (pos < content.length) {
        if (content[pos] === '"') {
            if (pos + 1 < content.length && content[pos + 1] === '"') {
                chars.push('"');
                pos += 2;
            } else {
                pos++;
                break;
            }
        } else {
            chars.push(content[pos]);
            pos++;
        }
    }

    return { value: chars.join(''), nextPosition: pos };
}

function parseUnquotedField(
    content: string,
    start: number
): { value: string; nextPosition: number } {
    let pos = start;

    while (pos < content.length) {
        const ch = content[pos];
        if (
            ch === ',' ||
            ch === '\n' ||
            (ch === '\r' && pos + 1 < content.length && content[pos + 1] === '\n')
        ) {
            break;
        }
        pos++;
    }

    return { value: content.substring(start, pos), nextPosition: pos };
}
