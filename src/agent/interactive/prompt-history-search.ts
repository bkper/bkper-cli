import type {
    AutocompleteItem,
    AutocompleteProvider,
    AutocompleteSuggestions,
} from '@earendil-works/pi-tui';
import {getKeybindings, matchesKey} from '@earendil-works/pi-tui';
import {
    searchPromptHistoryEntries,
    type PromptHistoryEntry,
    type PromptHistoryRepository,
} from './prompt-history-store.js';

export interface PromptHistoryEditor {
    getText(): string;
    getExpandedText?(): string;
    setText(text: string): void;
    handleInput(data: string): void;
    onSubmit?: (text: string) => void | Promise<void>;
}

interface InlineAutocompleteEditor extends PromptHistoryEditor {
    autocompleteProvider: AutocompleteProvider;
    setAutocompleteProvider(provider: AutocompleteProvider): void;
    requestAutocomplete(options: {force: boolean; explicitTab: boolean}): void;
    isShowingAutocomplete(): boolean;
}

const searchInstalledEditors = new WeakSet<PromptHistoryEditor>();
const recordingInstalledEditors = new WeakSet<PromptHistoryEditor>();
const DOWN_KEY_INPUT = '\x1b[B';

function collapsePreview(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function isBashInput(text: string): boolean {
    return text.trimStart().startsWith('!');
}

function supportsInlineAutocomplete(
    editor: PromptHistoryEditor
): editor is InlineAutocompleteEditor {
    const candidate = editor as PromptHistoryEditor & {
        autocompleteProvider?: AutocompleteProvider;
        setAutocompleteProvider?: (provider: AutocompleteProvider) => void;
        requestAutocomplete?: (options: {
            force: boolean;
            explicitTab: boolean;
        }) => void;
        isShowingAutocomplete?: () => boolean;
    };
    return (
        candidate.autocompleteProvider !== undefined &&
        typeof candidate.setAutocompleteProvider === 'function' &&
        typeof candidate.requestAutocomplete === 'function' &&
        typeof candidate.isShowingAutocomplete === 'function'
    );
}

export class PromptHistoryAutocompleteProvider implements AutocompleteProvider {
    constructor(
        private readonly entries: readonly PromptHistoryEntry[],
        private readonly includeBash: boolean
    ) {}

    async getSuggestions(
        lines: string[],
        _cursorLine: number,
        _cursorCol: number,
        _options: {signal: AbortSignal; force?: boolean}
    ): Promise<AutocompleteSuggestions | null> {
        const results = searchPromptHistoryEntries(
            this.entries,
            lines.join('\n'),
            {includeBash: this.includeBash}
        );
        if (results.length === 0) {
            return null;
        }
        return {
            items: results.map(entry => ({
                value: entry.text,
                label: collapsePreview(entry.text),
            })),
            prefix: '',
        };
    }

    applyCompletion(
        _lines: string[],
        _cursorLine: number,
        _cursorCol: number,
        item: AutocompleteItem,
        _prefix: string
    ): {lines: string[]; cursorLine: number; cursorCol: number} {
        const lines = item.value.split('\n');
        const cursorLine = Math.max(0, lines.length - 1);
        return {
            lines,
            cursorLine,
            cursorCol: lines[cursorLine]?.length ?? 0,
        };
    }
}

export function installPromptHistorySearch(
    editor: PromptHistoryEditor,
    history: Pick<PromptHistoryRepository, 'getEntries'>,
    includeBash: boolean
): void {
    if (searchInstalledEditors.has(editor) || !supportsInlineAutocomplete(editor)) {
        return;
    }
    searchInstalledEditors.add(editor);

    const handleInput = editor.handleInput.bind(editor);
    let originalProvider: AutocompleteProvider | undefined;
    let searching = false;

    const restoreProvider = (): void => {
        if (!searching || !originalProvider) {
            return;
        }
        editor.setAutocompleteProvider(originalProvider);
        originalProvider = undefined;
        searching = false;
    };

    const requestSuggestions = (): void => {
        editor.requestAutocomplete({force: false, explicitTab: true});
    };

    editor.handleInput = (data: string): void => {
        const keybindings = getKeybindings();
        if (matchesKey(data, 'ctrl+r')) {
            if (searching) {
                if (editor.isShowingAutocomplete()) {
                    handleInput(DOWN_KEY_INPUT);
                } else {
                    requestSuggestions();
                }
                return;
            }

            originalProvider = editor.autocompleteProvider;
            searching = true;
            editor.setAutocompleteProvider(
                new PromptHistoryAutocompleteProvider(history.getEntries(), includeBash)
            );
            requestSuggestions();
            return;
        }

        if (!searching) {
            handleInput(data);
            return;
        }

        if (keybindings.matches(data, 'tui.select.cancel')) {
            if (editor.isShowingAutocomplete()) {
                handleInput(data);
            }
            restoreProvider();
            return;
        }

        if (
            keybindings.matches(data, 'tui.select.confirm') ||
            keybindings.matches(data, 'tui.input.submit') ||
            keybindings.matches(data, 'tui.input.tab')
        ) {
            if (editor.isShowingAutocomplete()) {
                handleInput(data);
                restoreProvider();
            }
            return;
        }

        handleInput(data);
        if (!editor.isShowingAutocomplete()) {
            requestSuggestions();
        }
    };
}

export function installPromptHistoryEditor(
    editor: PromptHistoryEditor,
    history: PromptHistoryRepository
): void {
    installPromptHistorySearch(editor, history, true);

    if (recordingInstalledEditors.has(editor)) {
        return;
    }
    recordingInstalledEditors.add(editor);

    const submit = editor.onSubmit;
    if (submit) {
        editor.onSubmit = async (text: string): Promise<void> => {
            const normalized = text.trim();
            if (normalized) {
                history.record(normalized, isBashInput(normalized) ? 'bash' : 'standard');
            }
            await submit(text);
        };
    }
}
