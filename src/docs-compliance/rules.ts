export interface ComplianceError {
    code: string;
    message: string;
    line?: number;
}

export interface ComplianceResult {
    errors: ComplianceError[];
}

function getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
}

function findMissingQueryErrors(
    content: string,
    commandPattern: RegExp,
    code: string,
    message: string
): ComplianceError[] {
    const errors: ComplianceError[] = [];
    const regex = new RegExp(commandPattern.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        const command = match[0];
        if (!command.includes('-q ') && !command.includes('--query ')) {
            errors.push({
                code,
                message,
                line: getLineNumber(content, match.index),
            });
        }
    }
    return errors;
}

export function evaluateReadmeCompliance(content: string): ComplianceResult {
    const errors: ComplianceError[] = [];

    errors.push(
        ...findMissingQueryErrors(
            content,
            /^\s*bkper\s+transaction\s+list\b.*$/gm,
            'transaction-list-missing-query',
            'Found `bkper transaction list` example without `-q/--query`.'
        )
    );

    errors.push(
        ...findMissingQueryErrors(
            content,
            /^\s*bkper\s+balance\s+list\b.*$/gm,
            'balance-list-missing-query',
            'Found `bkper balance list` example without `-q/--query`.'
        )
    );

    const sameDayRangePattern = /after:\$DATE\s+before:\$DATE/g;
    let sameDayMatch: RegExpExecArray | null;
    while ((sameDayMatch = sameDayRangePattern.exec(content)) !== null) {
        errors.push({
            code: 'same-day-range-antipattern',
            message: 'Found `after:$DATE before:$DATE` anti-pattern. Prefer `on:$DATE`.',
            line: getLineNumber(content, sameDayMatch.index),
        });
    }

    const periodInQueryPattern = /(?:-q|--query)\s+['"][^'"\n]*period:/g;
    let periodMatch: RegExpExecArray | null;
    while ((periodMatch = periodInQueryPattern.exec(content)) !== null) {
        errors.push({
            code: 'period-operator-in-query-example',
            message:
                'Found `period:` in query example. Prefer documented query operators such as `on:`, `after:`, `before:`, and `by:`.',
            line: getLineNumber(content, periodMatch.index),
        });
    }

    const doubleQuotedDateVariablePattern =
        /(?:-q|--query)\s+"[^"\n]*(?<!\\)\$(?:d|m|y)(?:[+-]\d+)?[^"\n]*"/g;
    let doubleQuotedDateVariableMatch: RegExpExecArray | null;
    while (
        (doubleQuotedDateVariableMatch = doubleQuotedDateVariablePattern.exec(content)) !== null
    ) {
        errors.push({
            code: 'double-quoted-date-variable-query-example',
            message:
                'Found a double-quoted query example with an unescaped Bkper date variable. Prefer single quotes around queries using `$d`, `$m`, or `$y`, or escape `$` inside double quotes.',
            line: getLineNumber(content, doubleQuotedDateVariableMatch.index),
        });
    }

    if (
        content.includes(
            'Write commands (`account create`, `group create`, `transaction create`) accept JSON data piped via stdin'
        )
    ) {
        errors.push({
            code: 'group-create-stdin-documented',
            message: 'README should not document stdin batch creation for `group create`.',
        });
    }

    const groupPipePattern = /bkper\s+group\s+list\b.*\|\s*bkper\s+group\s+create\b/;
    if (groupPipePattern.test(content)) {
        errors.push({
            code: 'group-create-pipe-documented',
            message: 'README should not document piping group JSON into `group create`.',
        });
    }

    if (content.includes('**Group** (`bkper.Group`)')) {
        errors.push({
            code: 'group-stdin-fields-documented',
            message: 'README should not document stdin writable fields for `bkper.Group`.',
        });
    }

    const internalReleaseDetailPattern =
        /release:(patch|minor|major)|Trusted Publisher|GitHub Actions|CI\/CD|publishing policy|publish(?:ing)?\s+is\s+handled|maintainer-only procedures/i;
    const internalReleaseDetailMatch = internalReleaseDetailPattern.exec(content);
    if (internalReleaseDetailMatch) {
        errors.push({
            code: 'internal-release-process-documented',
            message:
                'README should not document internal release, publishing, CI/CD, or maintainer workflow details.',
            line: getLineNumber(content, internalReleaseDetailMatch.index),
        });
    }

    return {errors};
}
