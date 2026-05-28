export interface CliDispatchEnvironment {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
}

function getDefaultCliDispatchEnvironment(): CliDispatchEnvironment {
    return {
        stdinIsTTY: process.stdin.isTTY === true,
        stdoutIsTTY: process.stdout.isTTY === true,
    };
}

function isBareBkperInvocation(argv: string[]): boolean {
    return argv.length === 2;
}

function isInteractiveTerminal(environment: CliDispatchEnvironment): boolean {
    return environment.stdinIsTTY && environment.stdoutIsTTY;
}

export function shouldRunAgentCommand(
    argv: string[],
    environment: CliDispatchEnvironment = getDefaultCliDispatchEnvironment()
): boolean {
    if (argv[2] === 'agent') {
        return true;
    }

    return isBareBkperInvocation(argv) && isInteractiveTerminal(environment);
}

export function shouldShowHelpForBareInvocation(
    argv: string[],
    environment: CliDispatchEnvironment = getDefaultCliDispatchEnvironment()
): boolean {
    return isBareBkperInvocation(argv) && !isInteractiveTerminal(environment);
}

export function getAgentCommandArgs(argv: string[]): string[] {
    return argv[2] === 'agent' ? argv.slice(3) : [];
}
