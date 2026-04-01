import type { Command } from 'commander';
import { main as runPiMain } from '@mariozechner/pi-coding-agent';
import { runAgentMode } from '../agent/run-agent-mode.js';
import { getBkperAgentSystemPrompt } from '../agent/system-prompt.js';

export interface AgentCommandDependencies {
    runPi: (args: string[]) => Promise<void>;
    runInteractiveMode: () => Promise<void>;
}

function createDefaultDependencies(): AgentCommandDependencies {
    return {
        runPi: (args: string[]) => runPiMain(args),
        runInteractiveMode: () => runAgentMode(),
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

export async function runAgentCommand(
    piArgs: string[],
    dependencies: AgentCommandDependencies = createDefaultDependencies()
): Promise<void> {
    if (piArgs.length === 0) {
        await dependencies.runInteractiveMode();
        return;
    }

    const args = buildPiArgs(piArgs);
    await dependencies.runPi(args);
}

export function registerAgentCommands(program: Command): void {
    program
        .command('agent [piArgs...]')
        .description('Start Bkper Agent or run Pi CLI with Bkper defaults')
        .allowUnknownOption(true)
        .allowExcessArguments(true);
}
