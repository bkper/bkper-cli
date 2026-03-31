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

    const periodInQueryPattern = /-q\s+"[^"]*period:/g;
    let periodMatch: RegExpExecArray | null;
    while ((periodMatch = periodInQueryPattern.exec(content)) !== null) {
        errors.push({
            code: 'period-operator-in-query-example',
            message:
                'Found `period:` in query example. Prefer documented query operators such as `on:`, `after:`, `before:`, and `by:`.',
            line: getLineNumber(content, periodMatch.index),
        });
    }

    if (!content.includes('### Book setup guidance (important)')) {
        errors.push({
            code: 'missing-book-setup-guidance-title',
            message: 'Missing `Book setup guidance (important)` section.',
        });
    }

    if (
        !content.includes(
            'Create top-level groups first, then child groups with `--parent`, then accounts with `--groups`.'
        )
    ) {
        errors.push({
            code: 'missing-book-setup-order-guidance',
            message:
                'Missing guidance to create top-level groups first, then child groups, then accounts.',
        });
    }

    if (
        !content.includes(
            'Verify the resulting group hierarchy and account memberships before reporting success.'
        )
    ) {
        errors.push({
            code: 'missing-book-setup-verification-guidance',
            message: 'Missing guidance to verify hierarchy and account memberships before success.',
        });
    }

    if (!content.includes('LLM-first output guidance (important):')) {
        errors.push({
            code: 'missing-llm-guidance-title',
            message: 'Missing `LLM-first output guidance (important):` section.',
        });
    }

    if (!content.includes('**LLM consumption of lists/reports** → CSV')) {
        errors.push({
            code: 'missing-csv-guidance',
            message: 'Missing guidance mapping LLM list/report consumption to CSV.',
        });
    }

    if (!content.includes('**Programmatic processing / pipelines** → JSON')) {
        errors.push({
            code: 'missing-json-guidance',
            message: 'Missing guidance mapping programmatic pipelines to JSON.',
        });
    }

    if (!content.includes('### Query semantics (transactions and balances)')) {
        errors.push({
            code: 'missing-query-semantics-section',
            message: 'Missing `Query semantics (transactions and balances)` section.',
        });
    }

    if (!content.includes('`after:` is **inclusive** and `before:` is **exclusive**.')) {
        errors.push({
            code: 'missing-after-before-semantics',
            message: 'Missing explicit semantics for `after:` and `before:`.',
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
