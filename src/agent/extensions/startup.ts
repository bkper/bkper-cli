import {getKeybindings} from '@earendil-works/pi-tui';
import {
    getShellConfig,
    keyText,
    VERSION as PI_VERSION,
    type ExtensionAPI,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import {formatBkperSessionCommandShortcut} from '../interactive/session-keybindings.js';
import {runStartupMaintenance} from '../startup-maintenance.js';
import {getBkperHandoffShortcut} from './handoff.js';

type StartupHeaderComponent = {
    render: (width: number) => string[];
    invalidate: () => void;
    dispose?: () => void;
};

type StartupHeaderFactory = (_tui: unknown, theme: Theme) => StartupHeaderComponent;
type StartupExtensionAPI = Pick<ExtensionAPI, 'on'>;

type ModelRegistryLike = {
    getAvailable(): unknown[];
};

const STARTUP_LEFT_PADDING = ' ';
const NO_MODELS_STARTUP_HINT =
    'No AI model provider configured. Use /login for Bkper AI or /connect for another ' +
    'model provider.';

function wrapStartupHeaderLine(line: string, width: number): string[] {
    const normalizedWidth = Math.max(1, width);
    const trimmedLine = line.trim();

    if (!trimmedLine) {
        return [''];
    }

    const wrappedLines: string[] = [];
    let currentLine = '';

    const pushWord = (word: string): void => {
        if (!currentLine) {
            currentLine = word;
            return;
        }

        const candidate = `${currentLine} ${word}`;
        if (candidate.length <= normalizedWidth) {
            currentLine = candidate;
            return;
        }

        wrappedLines.push(currentLine);
        currentLine = word;
    };

    for (const word of trimmedLine.split(/\s+/)) {
        if (word.length <= normalizedWidth) {
            pushWord(word);
            continue;
        }

        if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = '';
        }

        for (let start = 0; start < word.length; start += normalizedWidth) {
            wrappedLines.push(word.slice(start, start + normalizedWidth));
        }
    }

    if (currentLine) {
        wrappedLines.push(currentLine);
    }

    return wrappedLines;
}

const BKPER_BANNER = [
    '██████╗ ██╗  ██╗██████╗ ███████╗██████╗ ',
    '██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██╔══██╗',
    '██████╔╝█████╔╝ ██████╔╝█████╗  ██████╔╝',
    '██╔══██╗██╔═██╗ ██╔═══╝ ██╔══╝  ██╔══██╗',
    '██████╔╝██║  ██╗██║     ███████╗██║  ██║',
    '╚═════╝ ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝',
];

function formatStartupHint(theme: Theme, key: string, description: string): string {
    return theme.fg('dim', key) + theme.fg('muted', ` ${description}`);
}

function isBashAvailable(shellPath?: string): boolean {
    try {
        getShellConfig(shellPath);
        return true;
    } catch {
        return false;
    }
}

function formatHandoffStartupCommand(): string {
    const shortcut = getBkperHandoffShortcut(getKeybindings().getResolvedBindings());
    return shortcut ? `/handoff (${shortcut})` : '/handoff';
}

function buildStartupHeaderLines(
    theme: Theme,
    modelRegistry: ModelRegistryLike,
    width: number,
    showBashShortcut: boolean
): string[] {
    const lines = [
        ...BKPER_BANNER.map(line => theme.bold(theme.fg('accent', line))),
        theme.fg('muted', `powered by `) + theme.fg('dim', `pi v${PI_VERSION}`),
        '',
        formatStartupHint(theme, keyText('app.interrupt'), 'to interrupt'),
        formatStartupHint(theme, keyText('app.clear'), 'to clear'),
        formatStartupHint(theme, `${keyText('app.clear')} twice`, 'to exit'),
        formatStartupHint(theme, '/', 'for commands'),
        formatStartupHint(theme, '/new', 'to start new session'),
        formatStartupHint(
            theme,
            formatBkperSessionCommandShortcut('/resume', 'app.session.resume'),
            'to resume a session'
        ),
        formatStartupHint(theme, '/clone', 'to duplicate session'),
        formatStartupHint(
            theme,
            formatBkperSessionCommandShortcut('/fork', 'app.session.fork'),
            'to branch from a message'
        ),
        formatStartupHint(
            theme,
            formatBkperSessionCommandShortcut('/tree', 'app.session.tree'),
            'for session tree'
        ),
        formatStartupHint(
            theme,
            formatHandoffStartupCommand(),
            'to continue in a focused session'
        ),
    ];

    if (showBashShortcut) {
        lines.push(formatStartupHint(theme, '!', 'to run bash'));
    }

    if (modelRegistry.getAvailable().length === 0) {
        lines.push(
            '',
            ...wrapStartupHeaderLine(NO_MODELS_STARTUP_HINT, width).map(line =>
                theme.fg('warning', line)
            )
        );
    }

    return lines.map(line => (line.length > 0 ? STARTUP_LEFT_PADDING + line : line));
}

function createStartupHeaderFactory(
    modelRegistry: ModelRegistryLike,
    showBashShortcut: boolean
): StartupHeaderFactory {
    return (_tui, theme) => ({
        render: (width: number) =>
            buildStartupHeaderLines(theme, modelRegistry, width, showBashShortcut),
        invalidate: () => {},
    });
}

export function registerBkperAgentStartupExtension(
    pi: StartupExtensionAPI,
    startupMaintenance: typeof runStartupMaintenance = runStartupMaintenance,
    settingsManager?: {
        getQuietStartup(): boolean;
        getShellPath?(): string | undefined;
    },
    bkperAiBaseUrlOverride?: string,
    bashAvailable: boolean = isBashAvailable(settingsManager?.getShellPath?.())
): void {
    let startupMaintenanceTriggered = false;

    pi.on('session_start', async (_event, ctx) => {
        if (!settingsManager?.getQuietStartup()) {
            ctx.ui.setHeader(
                createStartupHeaderFactory(ctx.modelRegistry, bashAvailable)
            );
        }

        if (startupMaintenanceTriggered) {
            return;
        }
        startupMaintenanceTriggered = true;

        if (bkperAiBaseUrlOverride) {
            ctx.ui.notify(
                `Bkper AI endpoint override active: ${bkperAiBaseUrlOverride}`,
                'warning'
            );
        }

        void startupMaintenance({
            notify: (message, type) => ctx.ui.notify(message, type),
        });
    });
}
