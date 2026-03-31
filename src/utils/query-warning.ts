const QUOTED_SEGMENT_PATTERN = /'[^']*'|"[^"]*"/g;
const EMPTY_DATE_OPERATOR_PATTERN = /(?:^|[\s(])(on|after|before):(?=$|[\s)])/g;
const BARE_SIGNED_OFFSET_PATTERN = /(?:^|[\s(])(on|after|before):([+-]\d{1,3})(?=$|[\s)])/g;

function sanitizeQueryForDateFragmentScan(query: string): string {
    return query.replace(QUOTED_SEGMENT_PATTERN, match => ' '.repeat(match.length));
}

function unique(items: string[]): string[] {
    const seen = new Set<string>();
    return items.filter(item => {
        if (seen.has(item)) {
            return false;
        }
        seen.add(item);
        return true;
    });
}

/**
 * Finds suspicious date query fragments that commonly appear when a shell expands
 * Bkper date variables like `$d`, `$m`, or `$y` before the CLI receives the
 * final query string.
 */
export function findSuspiciousDateQueryFragments(query: string): string[] {
    const sanitizedQuery = sanitizeQueryForDateFragmentScan(query);
    const fragments: string[] = [];

    EMPTY_DATE_OPERATOR_PATTERN.lastIndex = 0;
    let emptyOperatorMatch: RegExpExecArray | null;
    while ((emptyOperatorMatch = EMPTY_DATE_OPERATOR_PATTERN.exec(sanitizedQuery)) !== null) {
        fragments.push(`${emptyOperatorMatch[1]}:`);
    }

    BARE_SIGNED_OFFSET_PATTERN.lastIndex = 0;
    let bareSignedOffsetMatch: RegExpExecArray | null;
    while ((bareSignedOffsetMatch = BARE_SIGNED_OFFSET_PATTERN.exec(sanitizedQuery)) !== null) {
        fragments.push(`${bareSignedOffsetMatch[1]}:${bareSignedOffsetMatch[2]}`);
    }

    return unique(fragments);
}

/**
 * Builds a human-readable warning when the query looks like a shell-expanded
 * Bkper date variable.
 */
export function getSuspiciousDateVariableWarning(query: string): string | undefined {
    const fragments = findSuspiciousDateQueryFragments(query);
    if (fragments.length === 0) {
        return undefined;
    }

    return [
        `Warning: query contains suspicious date fragment(s): ${fragments.join(', ')}`,
        'This often happens when your shell expands Bkper date variables like $d, $m, or $y.',
        'Use single quotes around the query, for example:',
        "  -q 'on:$m'",
        "  -q 'after:$m-3 before:$m+1'",
        'Or escape $ inside double quotes:',
        '  -q "on:\\$m"',
        '  -q "after:\\$m-3 before:\\$m+1"',
    ].join('\n');
}

/**
 * Prints a warning to stderr when the query looks like a shell-expanded Bkper
 * date variable.
 */
export function warnIfSuspiciousDateVariableQuery(query: string): void {
    const warning = getSuspiciousDateVariableWarning(query);
    if (warning) {
        console.warn(warning);
    }
}
