import {matchesKey} from '@earendil-works/pi-tui';
import {
    startPromptHistorySearch,
    type PromptHistoryEditor,
} from './prompt-history-search.js';
import type {PromptHistoryRepository} from './prompt-history-store.js';
import {
    isShortcutClaimedByUserBinding,
    type BkperKeybindingsManager,
} from './session-keybindings.js';

type ExtensionShortcut = (data: string) => boolean;

interface PromptHistoryShortcutEditor extends PromptHistoryEditor {
    onExtensionShortcut?: ExtensionShortcut;
}

interface PromptHistoryShortcutHost {
    defaultEditor?: PromptHistoryShortcutEditor;
    editor?: PromptHistoryEditor;
    setupExtensionShortcuts?: (...args: unknown[]) => void;
}

export const PROMPT_HISTORY_SHORTCUT = 'ctrl+r';
const installedHosts = new WeakSet<PromptHistoryShortcutHost>();

export function installPromptHistoryShortcut(
    host: PromptHistoryShortcutHost,
    history: Pick<PromptHistoryRepository, 'getEntries'>,
    keybindings: Pick<BkperKeybindingsManager, 'getUserBindings'>
): void {
    if (installedHosts.has(host)) {
        return;
    }
    installedHosts.add(host);

    let installedHandler: ExtensionShortcut | undefined;
    const applyShortcut = (): void => {
        const defaultEditor = host.defaultEditor;
        if (
            !defaultEditor ||
            (installedHandler && defaultEditor.onExtensionShortcut === installedHandler)
        ) {
            return;
        }

        const extensionShortcut = defaultEditor.onExtensionShortcut;
        installedHandler = (data: string): boolean => {
            if (extensionShortcut?.(data)) {
                return true;
            }
            if (
                !matchesKey(data, PROMPT_HISTORY_SHORTCUT) ||
                isShortcutClaimedByUserBinding(
                    keybindings.getUserBindings(),
                    undefined,
                    PROMPT_HISTORY_SHORTCUT
                )
            ) {
                return false;
            }

            const activeEditor = host.editor;
            return activeEditor
                ? startPromptHistorySearch(activeEditor, history, true)
                : false;
        };
        defaultEditor.onExtensionShortcut = installedHandler;
    };

    const setupExtensionShortcuts = host.setupExtensionShortcuts?.bind(host);
    if (setupExtensionShortcuts) {
        host.setupExtensionShortcuts = (...args: unknown[]): void => {
            setupExtensionShortcuts(...args);
            applyShortcut();
        };
    }

    applyShortcut();
}
