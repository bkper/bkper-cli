import type { Command } from 'commander';
import { main as runPiMain } from '@earendil-works/pi-coding-agent';
import {
    createAgentModeDependencies,
    runAgentMode,
    type SessionOptions,
} from '../agent/run-agent-mode.js';
import { getBkperAgentSystemPrompt } from '../agent/system-prompt.js';

export interface AgentCommandEnvironment {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
}

export interface AgentCommandDependencies {
    runPi: (args: string[]) => Promise<void>;
    runInteractiveMode: (options?: SessionOptions) => Promise<void>;
    environment?: AgentCommandEnvironment;
}

// Unit tests and custom dependency injection historically omitted terminal state.
// Production dependencies always provide the real process TTY state below.
const ASSUMED_INTERACTIVE_ENVIRONMENT: AgentCommandEnvironment = {
    stdinIsTTY: true,
    stdoutIsTTY: true,
};

function createDefaultDependencies(): AgentCommandDependencies {
    return {
        runPi: (args: string[]) => runPiMain(args),
        runInteractiveMode: (options) => runAgentMode(createAgentModeDependencies(options)),
        environment: {
            stdinIsTTY: process.stdin.isTTY === true,
            stdoutIsTTY: process.stdout.isTTY === true,
        },
    };
}

function canRunEmbeddedInteractiveMode(dependencies: AgentCommandDependencies): boolean {
    const environment = dependencies.environment ?? ASSUMED_INTERACTIVE_ENVIRONMENT;
    return environment.stdinIsTTY && environment.stdoutIsTTY;
}

function hasSystemPromptArg(args: string[]): boolean {
    return args.some(arg => arg === '--system-prompt' || arg.startsWith('--system-prompt='));
}

function buildPiArgs(args: string[]): string[] {
    if (hasSystemPromptArg(args)) {
        return args;
    }

    return ['--system-prompt', getBkperAgentSystemPrompt(), ...args];
}

function isNonInteractiveArg(
    arg: string,
    nextArg: string | undefined
): {skipNext: boolean; nonInteractive: boolean} {
    if (arg === '--help' || arg === '-h')
        return {skipNext: false, nonInteractive: true};
    if (arg === '--version' || arg === '-v')
        return {skipNext: false, nonInteractive: true};
    if (arg === '--mode' && nextArg !== undefined) {
        return {
            skipNext: true,
            nonInteractive: nextArg === 'rpc' || nextArg === 'json',
        };
    }
    if (arg === '--print' || arg === '-p')
        return {skipNext: false, nonInteractive: true};
    if (arg === '--export' && nextArg !== undefined)
        return {skipNext: true, nonInteractive: true};
    if (arg === '--list-models') return {skipNext: false, nonInteractive: true};
    return {skipNext: false, nonInteractive: false};
}

function isInteractiveSessionArgs(args: string[]): boolean {
    for (let i = 0; i < args.length; i++) {
        const {skipNext, nonInteractive} = isNonInteractiveArg(args[i], args[i + 1]);
        if (nonInteractive) return false;
        if (skipNext) i++;
    }
    return true;
}

const PI_MANAGEMENT_COMMANDS = new Set([
    'install',
    'remove',
    'uninstall',
    'update',
    'list',
    'config',
]);

function isPiManagementCommand(args: string[]): boolean {
    const [command] = args;
    return command !== undefined && PI_MANAGEMENT_COMMANDS.has(command);
}

function parseSessionOptions(
    args: string[]
): {options: SessionOptions; remainingArgs: string[]} {
    const options: SessionOptions = {};
    const remainingArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--continue' || arg === '-c') {
            options.continueSession = true;
        } else if (arg === '--resume' || arg === '-r') {
            options.continueSession = true;
        } else if (arg === '--no-session') {
            options.noSession = true;
        } else {
            remainingArgs.push(arg);
        }
    }

    return {options, remainingArgs};
}

export async function runAgentCommand(
    piArgs: string[],
    dependencies: AgentCommandDependencies = createDefaultDependencies()
): Promise<void> {
    const canRunEmbeddedInteractive = canRunEmbeddedInteractiveMode(dependencies);

    if (piArgs.length === 0) {
        if (!canRunEmbeddedInteractive) {
            await dependencies.runPi(buildPiArgs(piArgs));
            return;
        }

        await dependencies.runInteractiveMode();
        return;
    }

    if (isPiManagementCommand(piArgs)) {
        await dependencies.runPi(piArgs);
        return;
    }

    if (!isInteractiveSessionArgs(piArgs)) {
        const args = buildPiArgs(piArgs);
        await dependencies.runPi(args);
        return;
    }

    const {options, remainingArgs} = parseSessionOptions(piArgs);

    if (remainingArgs.length > 0 || !canRunEmbeddedInteractive) {
        // Unsupported interactive args (e.g. --session, --fork) or non-interactive
        // terminals are forwarded to pi for normal passthrough behavior.
        const args = buildPiArgs(piArgs);
        await dependencies.runPi(args);
        return;
    }

    await dependencies.runInteractiveMode(options);
}

export function registerAgentCommands(program: Command): void {
    program
        .command('agent [piArgs...]')
        .description('Start Bkper Agent or run Pi CLI with Bkper defaults')
        .allowUnknownOption(true)
        .allowExcessArguments(true);
}
