export interface LiveCheckConfig {
    cliCmd: string;
    bookId: string;
    accountName?: string;
    balanceSheetRootGroup?: string;
    profitAndLossRootGroup?: string;
}

export interface MaterializedCommand {
    command?: string;
    skipReason?: string;
}

function getBashCodeBlocks(content: string): string[] {
    const blocks: string[] = [];
    const regex = /```bash\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        blocks.push(match[1]);
    }

    return blocks;
}

function flattenContinuationLines(block: string): string[] {
    const lines = block.split('\n').map(line => line.trimEnd());
    const flattened: string[] = [];

    let buffer = '';
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        if (!buffer) {
            buffer = line;
        } else {
            buffer = `${buffer} ${line}`;
        }

        if (line.endsWith('\\')) {
            buffer = buffer.slice(0, -1).trimEnd();
            continue;
        }

        flattened.push(buffer.replace(/\s+/g, ' ').trim());
        buffer = '';
    }

    if (buffer) {
        flattened.push(buffer.replace(/\s+/g, ' ').trim());
    }

    return flattened;
}

function isRunnableQueryCommand(command: string): boolean {
    if (command.includes('|')) {
        return false;
    }

    const queryListPattern = /^bkper\s+(transaction|balance)\s+list\b/i;
    if (!queryListPattern.test(command)) {
        return false;
    }

    return command.includes('-q ') || command.includes('--query ');
}

export function extractRunnableQueryCommands(content: string): string[] {
    const blocks = getBashCodeBlocks(content);
    const commands: string[] = [];

    for (const block of blocks) {
        const flattened = flattenContinuationLines(block);
        for (const command of flattened) {
            if (isRunnableQueryCommand(command)) {
                commands.push(command);
            }
        }
    }

    return commands;
}

export function materializeCommand(
    command: string,
    config: LiveCheckConfig
): MaterializedCommand {
    const replacements: Array<[string, string | undefined]> = [
        ['abc123', config.bookId],
        ['<bookId>', config.bookId],
        ['$BOOK_ID', config.bookId],
        ['$BOOK', config.bookId],
        ['$BOOK_A', config.bookId],
        ['$SOURCE', config.bookId],
        ['<accountName>', config.accountName],
        ['<balanceSheetRootGroup>', config.balanceSheetRootGroup],
        ['<profitAndLossRootGroup>', config.profitAndLossRootGroup],
    ];

    let materialized = command.replace(/^bkper\b/, config.cliCmd);

    for (const [token, value] of replacements) {
        if (value) {
            materialized = materialized.split(token).join(value);
        }
    }

    const unresolvedPlaceholderPattern = /<[^>]+>|\$[A-Z_]+/;
    if (unresolvedPlaceholderPattern.test(materialized)) {
        return {
            skipReason: `unresolved placeholders in command: ${materialized}`,
        };
    }

    if (!materialized.includes('--format ')) {
        materialized = `${materialized} --format csv`;
    }

    return {command: materialized};
}
