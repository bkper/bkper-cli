import path from 'node:path';
import type { Command } from 'commander';
import {
    main as runPiMain,
    parseArgs,
    type Args,
    type MainOptions,
} from '@earendil-works/pi-coding-agent';
import { registerBkperAiProvider } from '../agent/extensions/bkper-ai-provider.js';
import {
    createAgentModeDependencies,
    runAgentMode,
    type SessionOptions,
} from '../agent/interactive/run-agent-mode.js';
import { AgentStartupError } from '../agent/startup-error.js';
import { getBkperAgentSystemPrompt } from '../agent/system-prompt.js';
import { BOOK_ID } from './context/platform-context.js';

export interface AgentCommandEnvironment {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
}

export interface AgentCommandDependencies {
    runPi: (args: string[], options?: MainOptions) => Promise<void>;
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
        runPi: (args: string[], options?: MainOptions) => runPiMain(args, options),
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

/**
 * Sessions forwarded to pi (`--list-models`, print, json, and rpc modes) offer Bkper AI models like
 * the embedded interactive mode. Management commands such as `config` stay plain pi.
 */
const PI_SESSION_OPTIONS: MainOptions = {
    extensionFactories: [registerBkperAiProvider],
};

function hasSystemPromptArg(args: string[]): boolean {
    return args.some(arg => arg === '--system-prompt' || arg.startsWith('--system-prompt='));
}

function buildPiArgs(args: string[]): string[] {
    if (hasSystemPromptArg(args)) {
        return args;
    }

    return ['--system-prompt', getBkperAgentSystemPrompt(), ...args];
}


const PI_MANAGEMENT_COMMANDS = new Set([
    'install',
    'remove',
    'uninstall',
    'update',
    'list',
    'config',
    'mcp',
]);

function isPiManagementCommand(args: string[]): boolean {
    const [command] = args;
    return command !== undefined && PI_MANAGEMENT_COMMANDS.has(command);
}

/** Parsed Pi args that Bkper Agent's interactive mode supports; any other set arg goes to pi. */
const EMBEDDED_ARG_KEYS = new Set<keyof Args>([
    'continue',
    'resume',
    'noSession',
    'session',
    'provider',
    'model',
    'thinking',
    'tools',
    'extensions',
    'noExtensions',
    'noSkills',
    'noPromptTemplates',
    'noContextFiles',
    'projectTrustOverride',
    'messages',
    'fileArgs',
    'unknownFlags',
    'diagnostics',
]);

/** Pi treats a `--session` value with a path separator or `.jsonl` suffix as a file path. */
function isSessionPath(value: string): boolean {
    return value.includes('/') || value.includes('\\') || value.endsWith('.jsonl');
}

function hasOnlyEmbeddedArgs(parsed: Args): boolean {
    const keys = Object.keys(parsed) as Array<keyof Args>;
    return (
        keys.every(key => EMBEDDED_ARG_KEYS.has(key) || parsed[key] === undefined) &&
        parsed.unknownFlags.size === 0 &&
        parsed.diagnostics.length === 0 &&
        // Bkper Agent trusts the project; only pi can ignore project-local files (--no-approve).
        parsed.projectTrustOverride !== false &&
        // Session ids are looked up by pi; Bkper Agent opens session files.
        (parsed.session === undefined || isSessionPath(parsed.session))
    );
}

/**
 * Maps Pi args to Bkper Agent session options, or returns undefined when an arg is only
 * supported by pi.
 */
export function parseEmbeddedSessionOptions(
    args: string[],
    cwd: string = process.cwd()
): SessionOptions | undefined {
    const parsed = parseArgs(args);
    if (!hasOnlyEmbeddedArgs(parsed)) {
        return undefined;
    }

    const options: SessionOptions = {
        continueSession: parsed.continue || parsed.resume || undefined,
        noSession: parsed.noSession,
        sessionFile: parsed.session ? path.resolve(cwd, parsed.session) : undefined,
        provider: parsed.provider,
        model: parsed.model,
        thinking: parsed.thinking,
        tools: parsed.tools,
        extensionPaths: parsed.extensions,
        noExtensions: parsed.noExtensions,
        noSkills: parsed.noSkills,
        noPromptTemplates: parsed.noPromptTemplates,
        noContextFiles: parsed.noContextFiles,
        messages: parsed.messages.length > 0 ? parsed.messages : undefined,
        fileArgs: parsed.fileArgs.length > 0 ? parsed.fileArgs : undefined,
    };
    return Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined)
    ) as SessionOptions;
}

/**
 * Bkper's own `-b, --book <bookId>` (Pi has no `-b`): the Book whose agent context loads beside the user's. Taken out
 * before Pi parses the rest.
 */
export function takeBookOption(args: string[]): { bookId?: string; args: string[] } {
    const rest: string[] = [];
    let bookId: string | undefined;
    for (let index = 0; index < args.length; index++) {
        const arg = args[index]!;
        let value: string | undefined;
        if (arg === '-b' || arg === '--book') {
            value = args[++index];
            if (value === undefined) throw new AgentStartupError(`${arg} requires a Book ID`);
        } else if (arg.startsWith('--book=')) {
            value = arg.slice('--book='.length);
        } else {
            rest.push(arg);
            continue;
        }
        if (!BOOK_ID.test(value)) throw new AgentStartupError(`'${value}' is not a Book ID`);
        bookId = value;
    }
    return { ...(bookId ? { bookId } : {}), args: rest };
}

export async function runAgentCommand(
    allArgs: string[],
    dependencies: AgentCommandDependencies = createDefaultDependencies()
): Promise<void> {
    const canRunEmbeddedInteractive = canRunEmbeddedInteractiveMode(dependencies);
    const { bookId, args: piArgs } = isPiManagementCommand(allArgs) ? { args: allArgs } : takeBookOption(allArgs);
    const embedded = (options: SessionOptions | undefined): SessionOptions | undefined =>
        bookId ? { bookId, ...options } : options;

    if (piArgs.length === 0) {
        if (!canRunEmbeddedInteractive) {
            refuseBookOutsideAgent(bookId);
            await dependencies.runPi(buildPiArgs(piArgs), PI_SESSION_OPTIONS);
            return;
        }

        await dependencies.runInteractiveMode(embedded(undefined));
        return;
    }

    if (isPiManagementCommand(piArgs)) {
        await dependencies.runPi(piArgs);
        return;
    }

    const options = parseEmbeddedSessionOptions(piArgs);

    if (!options || !canRunEmbeddedInteractive) {
        // Args only pi supports (e.g. --fork, --print, --mode) or non-interactive
        // terminals are forwarded to pi for normal passthrough behavior.
        refuseBookOutsideAgent(bookId);
        const args = buildPiArgs(piArgs);
        await dependencies.runPi(args, PI_SESSION_OPTIONS);
        return;
    }

    await dependencies.runInteractiveMode(embedded(options));
}

/** A Book's context loads only in Bkper Agent's interactive mode; never silently dropped. */
function refuseBookOutsideAgent(bookId: string | undefined): void {
    if (bookId) {
        throw new AgentStartupError('--book works only in the interactive agent, without options only pi supports');
    }
}

export function registerAgentCommands(program: Command): void {
    program
        .command('agent [piArgs...]')
        .description(
            'Start Bkper Agent, or run Pi CLI commands as `bkper agent <command>` (e.g. `bkper agent mcp add`)'
        )
        .option('-b, --book <bookId>', "Load this Book's agent context beside yours")
        .allowUnknownOption(true)
        .allowExcessArguments(true);
}
