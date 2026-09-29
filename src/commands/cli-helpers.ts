import { InvalidArgumentError, Option, type Command } from 'commander';

const JSON_ONLY_MESSAGE =
    "Output is JSON only. Reshape with jq, e.g. jq -r '.items[] | [.date, .amount] | @csv'";

/**
 * Commander option collector for repeatable scalar flags.
 */
export function collectRepeatable(value: string, previous: string[] | undefined): string[] {
    return previous ? [...previous, value] : [value];
}

/**
 * Commander option collector for repeatable --property flags.
 */
export function collectProperty(value: string, previous: string[] | undefined): string[] {
    return collectRepeatable(value, previous);
}

/**
 * Commander option collector for repeatable --book flags.
 */
export function collectBook(value: string, previous: string[] | undefined): string[] {
    return collectRepeatable(value, previous);
}

/**
 * Commander parser for positive integer options such as pagination limits.
 */
export function parsePositiveInteger(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Value must be a positive integer');
    }
    return parsed;
}

/**
 * Commander parser for the legacy --format flag. Output is JSON only, so only
 * `json` is accepted; other formats fail with guidance to reshape via jq.
 */
export function parseOutputFormat(value: string): 'json' {
    if (value === 'json') {
        return value;
    }
    throw new InvalidArgumentError(JSON_ONLY_MESSAGE);
}

/**
 * Registers the legacy global output flags as hidden options.
 * `--json` and `--format json` are accepted no-ops kept for compatibility.
 */
export function registerOutputOptions(command: Command): void {
    command.addOption(
        new Option('--format <format>', 'Output format (JSON only)')
            .argParser(parseOutputFormat)
            .hideHelp()
    );
    command.addOption(new Option('--json', 'Output as JSON (default)').hideHelp());
}
