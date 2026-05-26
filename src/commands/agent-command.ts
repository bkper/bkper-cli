import type { Command } from 'commander';
import { main as runPiMain } from '@earendil-works/pi-coding-agent';
import {
    createAgentModeDependencies,
    runAgentMode,
    type SessionOptions,
} from '../agent/run-agent-mode.js';
import { getBkperAgentSystemPrompt } from '../agent/system-prompt.js';

export interface AgentCommandDependencies {
    runPi: (args: string[]) => Promise<void>;
    runInteractiveMode: (options?: SessionOptions) => Promise<void>;
}

function createDefaultDependencies(): AgentCommandDependencies {
    return {
        runPi: (args: string[]) => runPiMain(args),
        runInteractiveMode: (options) => runAgentMode(createAgentModeDependencies(options)),
    };
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
    if (piArgs.length === 0) {
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

    if (remainingArgs.length > 0) {
        // Unsupported interactive args (e.g. --session, --fork)
        // Forward to pi so the user still gets a working session.
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
