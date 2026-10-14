import {
    getAgentDir,
    InteractiveMode,
    type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import {installBkperAuthCommandRouting} from '../extensions/auth-commands.js';
import {
    installPromptHistoryEditor,
    type PromptHistoryEditor,
} from './prompt-history-search.js';
import {installPromptHistoryShortcut} from './prompt-history-shortcut.js';
import {
    FilePromptHistory,
    getPromptHistoryPath,
} from './prompt-history-store.js';
import {
    installBkperSessionKeybindings,
    type BkperKeybindingsManager,
} from './session-keybindings.js';

export type InteractiveRuntimeHost = ConstructorParameters<typeof InteractiveMode>[0];

const PI_RESUME_HINT_TEXT = 'To resume this session:';
const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g;

function isPiResumeHintOutput(chunk: string): boolean {
    return chunk.replace(ANSI_PATTERN, '').trimStart().startsWith(PI_RESUME_HINT_TEXT);
}

export function suppressPiResumeHintOutput(): () => void {
    const originalWrite = process.stdout.write;

    process.stdout.write = function (
        this: typeof process.stdout,
        chunk: string | Uint8Array,
        encoding?: BufferEncoding,
        callback?: (err?: Error | null) => void
    ): boolean {
        if (typeof chunk === 'string' && isPiResumeHintOutput(chunk)) {
            return true;
        }

        return originalWrite.call(this, chunk, encoding, callback);
    } as typeof process.stdout.write;

    return () => {
        process.stdout.write = originalWrite;
    };
}

type StartupHeaderHost = {
    shouldShowStartupHeader: () => boolean;
    resetExtensionUI: () => void;
    setExtensionHeader: (factory: unknown) => void;
};

/**
 * The Bkper startup extension owns the header, so Pi's own header must never render: Pi builds only
 * an empty placeholder, and the current header stays in place while a session switch resets the
 * extension UI, until the new session's start replaces it. Otherwise Pi's header blinks first.
 */
function installBkperStartupHeader(mode: object): void {
    const host = mode as StartupHeaderHost;
    const piMode = InteractiveMode.prototype as unknown as StartupHeaderHost;
    let resettingExtensionUI = false;

    host.shouldShowStartupHeader = () => false;
    host.setExtensionHeader = factory => {
        if (factory || !resettingExtensionUI) {
            piMode.setExtensionHeader.call(mode, factory);
        }
    };
    host.resetExtensionUI = () => {
        resettingExtensionUI = true;
        try {
            piMode.resetExtensionUI.call(mode);
        } finally {
            resettingExtensionUI = false;
        }
    };
}

export class BkperInteractiveMode extends InteractiveMode {
    async init(): Promise<void> {
        const interactiveMode = this as unknown as {
            getChangelogForDisplay: () => undefined;
            keybindings?: BkperKeybindingsManager;
        };
        interactiveMode.getChangelogForDisplay = () => undefined;
        installBkperStartupHeader(this);

        if (interactiveMode.keybindings) {
            installBkperSessionKeybindings(interactiveMode.keybindings);
        }

        await super.init();

        const authRoutingMode = this as unknown as {
            defaultEditor?: PromptHistoryEditor;
            editor?: PromptHistoryEditor;
            session?: {
                modelRuntime?: {
                    unregisterProvider(name: string): void;
                    registerProvider(
                        name: string,
                        config: Parameters<ExtensionAPI['registerProvider']>[1]
                    ): void;
                };
            };
        };

        const promptHistory = new FilePromptHistory(
            getPromptHistoryPath(getAgentDir())
        );

        const providerRegistry = authRoutingMode.session?.modelRuntime;
        if (providerRegistry) {
            const editors = new Set(
                [authRoutingMode.defaultEditor, authRoutingMode.editor].filter(
                    editor => editor !== undefined
                )
            );
            for (const editor of editors) {
                installBkperAuthCommandRouting(editor, providerRegistry);
            }
        }

        const editors = new Set(
            [authRoutingMode.defaultEditor, authRoutingMode.editor].filter(
                editor => editor !== undefined
            )
        );
        for (const editor of editors) {
            installPromptHistoryEditor(editor, promptHistory, false);
        }

        if (interactiveMode.keybindings) {
            installPromptHistoryShortcut(
                authRoutingMode,
                promptHistory,
                interactiveMode.keybindings
            );
        }
    }

    async run(): Promise<void> {
        const restoreResumeHintOutput = suppressPiResumeHintOutput();

        try {
            await super.run();
        } finally {
            restoreResumeHintOutput();
        }
    }
}
