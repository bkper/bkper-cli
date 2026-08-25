import {keyText} from '@earendil-works/pi-coding-agent';

type KeybindingsConfigValue = string | string[] | undefined;
export type KeybindingsConfigLike = Record<string, KeybindingsConfigValue>;

export type BkperKeybindingsManager = {
    getUserBindings(): KeybindingsConfigLike;
    setUserBindings(userBindings: KeybindingsConfigLike): void;
    reload(): void;
};

const BKPER_SESSION_KEYBINDINGS = {
    'app.session.resume': 'ctrl+s',
    'app.session.tree': 'ctrl+alt+r',
    'app.session.fork': 'ctrl+x',
} as const;

const LEGACY_BKPER_TREE_SHORTCUT = 'ctrl+r';

const installedBkperKeybindingsManagers = new WeakSet<BkperKeybindingsManager>();

function keybindingConfigIncludesShortcut(
    configuredBinding: KeybindingsConfigValue,
    shortcut: string
): boolean {
    const normalizedShortcut = shortcut.toLowerCase();
    const configuredShortcuts = Array.isArray(configuredBinding)
        ? configuredBinding
        : [configuredBinding];

    return configuredShortcuts.some(
        configuredShortcut => configuredShortcut?.toLowerCase() === normalizedShortcut
    );
}

export function isShortcutClaimedByUserBinding(
    userBindings: KeybindingsConfigLike,
    targetKeybinding: string | undefined,
    shortcut: string
): boolean {
    return Object.entries(userBindings).some(
        ([keybinding, configuredBinding]) =>
            keybinding !== targetKeybinding &&
            keybindingConfigIncludesShortcut(configuredBinding, shortcut)
    );
}

export function applyBkperSessionKeybindings(
    keybindings: Pick<BkperKeybindingsManager, 'getUserBindings' | 'setUserBindings'>
): void {
    const userBindings = keybindings.getUserBindings();
    const nextBindings: KeybindingsConfigLike = {...userBindings};
    let changed = false;

    for (const [keybinding, shortcut] of Object.entries(BKPER_SESSION_KEYBINDINGS)) {
        if (
            keybinding === 'app.session.tree' &&
            typeof nextBindings[keybinding] === 'string' &&
            nextBindings[keybinding].toLowerCase() === LEGACY_BKPER_TREE_SHORTCUT &&
            !isShortcutClaimedByUserBinding(userBindings, keybinding, shortcut)
        ) {
            nextBindings[keybinding] = shortcut;
            changed = true;
            continue;
        }

        if (
            nextBindings[keybinding] !== undefined ||
            isShortcutClaimedByUserBinding(userBindings, keybinding, shortcut)
        ) {
            continue;
        }

        nextBindings[keybinding] = shortcut;
        changed = true;
    }

    if (changed) {
        keybindings.setUserBindings(nextBindings);
    }
}

export function installBkperSessionKeybindings(keybindings: BkperKeybindingsManager): void {
    if (!installedBkperKeybindingsManagers.has(keybindings)) {
        const reload = keybindings.reload.bind(keybindings);
        keybindings.reload = () => {
            reload();
            applyBkperSessionKeybindings(keybindings);
        };
        installedBkperKeybindingsManagers.add(keybindings);
    }

    applyBkperSessionKeybindings(keybindings);
}

export function formatBkperSessionCommandShortcut(
    command: string,
    keybinding: keyof typeof BKPER_SESSION_KEYBINDINGS
): string {
    const shortcut = keyText(keybinding);
    return shortcut ? `${command} (${shortcut})` : command;
}
