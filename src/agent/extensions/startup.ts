import {getKeybindings, truncateToWidth, visibleWidth} from '@earendil-works/pi-tui';
import {
    getShellConfig,
    keyText,
    VERSION as PI_VERSION,
    type ExtensionAPI,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import {PROMPT_HISTORY_SHORTCUT} from '../interactive/prompt-history-shortcut.js';
import {
    formatBkperSessionCommandShortcut,
    isShortcutClaimedByUserBinding,
} from '../interactive/session-keybindings.js';
import {runStartupMaintenance} from '../startup-maintenance.js';
import {getBkperHandoffShortcut} from './handoff.js';
import {getBkperLogoLines} from './startup-logo.js';

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

type StartupHint = {key: string; description: string};

const STARTUP_LEFT_PADDING = ' ';
const HINT_COLUMN_GAP = '    ';
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

function formatStartupHint(theme: Theme, hint: StartupHint): string {
    return theme.fg('accent', hint.key) + theme.fg('muted', ` ${hint.description}`);
}

/**
 * Lays hints out in two columns when both fit in the width, filling the left column first so
 * related hints stay together; otherwise one column.
 */
function layoutStartupHints(theme: Theme, hints: StartupHint[], width: number): string[] {
    const cells = hints.map(hint => formatStartupHint(theme, hint));
    const leftCount = Math.ceil(cells.length / 2);
    const left = cells.slice(0, leftCount);
    const right = cells.slice(leftCount);
    const leftWidth = Math.max(0, ...left.map(visibleWidth));
    const rightWidth = Math.max(0, ...right.map(visibleWidth));

    if (leftWidth + HINT_COLUMN_GAP.length + rightWidth > width) {
        return cells;
    }

    return left.map((cell, index) => {
        const rightCell = right[index];
        return rightCell === undefined
            ? cell
            : cell + ' '.repeat(leftWidth - visibleWidth(cell)) + HINT_COLUMN_GAP + rightCell;
    });
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

function getStartupHints(showBashShortcut: boolean): StartupHint[] {
    const showPromptHistory = !isShortcutClaimedByUserBinding(
        getKeybindings().getUserBindings(),
        undefined,
        PROMPT_HISTORY_SHORTCUT
    );

    return [
        {key: keyText('app.interrupt'), description: 'to interrupt'},
        {key: keyText('app.clear'), description: 'to clear'},
        {key: `${keyText('app.clear')} twice`, description: 'to exit'},
        ...(showPromptHistory
            ? [{key: PROMPT_HISTORY_SHORTCUT, description: 'to search prompt history'}]
            : []),
        {key: '/', description: 'for commands'},
        ...(showBashShortcut ? [{key: '!', description: 'to run bash'}] : []),
        {key: '/new', description: 'to start new session'},
        {
            key: formatBkperSessionCommandShortcut('/resume', 'app.session.resume'),
            description: 'to resume a session',
        },
        {key: '/clone', description: 'to duplicate session'},
        {
            key: formatBkperSessionCommandShortcut('/fork', 'app.session.fork'),
            description: 'to branch from a message',
        },
        {
            key: formatBkperSessionCommandShortcut('/tree', 'app.session.tree'),
            description: 'for session tree',
        },
        {key: formatHandoffStartupCommand(), description: 'to continue in a focused session'},
    ];
}

function buildStartupHeaderLines(
    theme: Theme,
    modelRegistry: ModelRegistryLike,
    width: number,
    showBashShortcut: boolean
): string[] {
    const contentWidth = Math.max(1, width - STARTUP_LEFT_PADDING.length);
    const logo = getBkperLogoLines(contentWidth, theme.getColorMode());
    const lines = [
        ...logo,
        ...(logo.length > 0 ? [''] : []),
        theme.fg('muted', 'powered by ') + theme.fg('dim', `pi v${PI_VERSION}`),
        '',
        ...layoutStartupHints(theme, getStartupHints(showBashShortcut), contentWidth),
    ];

    if (modelRegistry.getAvailable().length === 0) {
        lines.push(
            '',
            ...wrapStartupHeaderLine(NO_MODELS_STARTUP_HINT, contentWidth).map(line =>
                theme.fg('warning', line)
            )
        );
    }

    // The TUI rejects lines wider than the terminal, so narrow terminals truncate hints.
    return lines.map(line =>
        line.length > 0 ? STARTUP_LEFT_PADDING + truncateToWidth(line, contentWidth) : line
    );
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
        getDefaultTools?(): string[] | undefined;
    },
    bkperAiBaseUrlOverride?: string,
    bashAvailable?: boolean
): void {
    let startupMaintenanceTriggered = false;

    pi.on('session_start', async (_event, ctx) => {
        if (!settingsManager?.getQuietStartup()) {
            const showBashShortcut =
                bashAvailable ??
                ((settingsManager?.getDefaultTools?.()?.includes('bash') ?? true) &&
                    isBashAvailable(settingsManager?.getShellPath?.()));
            ctx.ui.setHeader(
                createStartupHeaderFactory(ctx.modelRegistry, showBashShortcut)
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
