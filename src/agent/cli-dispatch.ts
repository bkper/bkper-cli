export interface CliDispatchEnvironment {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
}

export function shouldStartAgentMode(
    argv: string[],
    environment: CliDispatchEnvironment = {
        stdinIsTTY: process.stdin.isTTY === true,
        stdoutIsTTY: process.stdout.isTTY === true,
    }
): boolean {
    return argv.length === 2 && environment.stdinIsTTY && environment.stdoutIsTTY;
}
