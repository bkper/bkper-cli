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

    return {errors};
}
