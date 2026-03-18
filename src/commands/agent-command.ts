import type { Command } from 'commander';
import { main as runPiMain } from '@mariozechner/pi-coding-agent';
import { getBkperAgentSystemPrompt } from '../agent/system-prompt.js';

export interface AgentCommandDependencies {
    runPi: (args: string[]) => Promise<void>;
}

function createDefaultDependencies(): AgentCommandDependencies {
    return {
        runPi: (args: string[]) => runPiMain(args),
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

export function registerAgentCommands(
    program: Command,
    dependencies: AgentCommandDependencies = createDefaultDependencies()
): void {
    program
        .command('agent [piArgs...]')
        .description('Run Pi CLI with Bkper defaults (passthrough)')
        .allowUnknownOption(true)
        .allowExcessArguments(true)
        .action(async (piArgs: string[] = []) => {
            try {
                const args = buildPiArgs(piArgs);
                await dependencies.runPi(args);
            } catch (err) {
                console.error('Error running agent command:', err);
                process.exit(1);
            }
        });
}
