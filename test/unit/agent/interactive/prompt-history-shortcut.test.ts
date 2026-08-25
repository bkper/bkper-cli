import type {AutocompleteProvider} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    PromptHistoryAutocompleteProvider,
    type PromptHistoryEditor,
} from '../../../../src/agent/interactive/prompt-history-search.js';
import {installPromptHistoryShortcut} from '../../../../src/agent/interactive/prompt-history-shortcut.js';
import type {PromptHistoryRepository} from '../../../../src/agent/interactive/prompt-history-store.js';

function createAutocompleteProvider(): AutocompleteProvider {
    return {
        getSuggestions: async () => null,
        applyCompletion: (lines, cursorLine, cursorCol) => ({
            lines,
            cursorLine,
            cursorCol,
        }),
    };
}

interface TestPromptHistoryEditor extends PromptHistoryEditor {
    readonly autocompleteProvider: AutocompleteProvider;
    readonly activeProvider: AutocompleteProvider;
    onExtensionShortcut?: (data: string) => boolean;
    setAutocompleteProvider(provider: AutocompleteProvider): void;
    requestAutocomplete: sinon.SinonStub;
    isShowingAutocomplete(): boolean;
}

function createEditor(): TestPromptHistoryEditor {
    let activeProvider = createAutocompleteProvider();
    const requestAutocomplete = sinon.stub();
    return {
        getText: () => '',
        setText: sinon.stub(),
        handleInput: sinon.stub(),
        get autocompleteProvider() {
            return activeProvider;
        },
        get activeProvider() {
            return activeProvider;
        },
        setAutocompleteProvider: (provider: AutocompleteProvider) => {
            activeProvider = provider;
        },
        requestAutocomplete,
        isShowingAutocomplete: () => false,
    };
}

const history: Pick<PromptHistoryRepository, 'getEntries'> = {
    getEntries: () => [
        {text: 'latest prompt', kind: 'standard', timestamp: 1},
    ],
};

describe('prompt history shortcut', function () {
    it('starts history search in a replacement editor that forwards app shortcuts', function () {
        const defaultEditor = createEditor();
        const replacementEditor = createEditor();
        const extensionShortcut = sinon.stub().returns(false);
        const host = {
            defaultEditor,
            editor: defaultEditor,
            setupExtensionShortcuts: () => {
                defaultEditor.onExtensionShortcut = extensionShortcut;
            },
        };

        installPromptHistoryShortcut(host, history, {
            getUserBindings: () => ({}),
        });
        host.setupExtensionShortcuts();
        host.editor = replacementEditor;
        replacementEditor.handleInput = (data: string): void => {
            defaultEditor.onExtensionShortcut?.(data);
        };

        replacementEditor.handleInput('\x12');

        expect(extensionShortcut.calledOnceWithExactly('\x12')).to.equal(true);
        expect(replacementEditor.activeProvider).to.be.instanceOf(
            PromptHistoryAutocompleteProvider
        );
    });

    it('lets a replacement editor intentionally intercept Ctrl+R', function () {
        const defaultEditor = createEditor();
        const replacementEditor = createEditor();
        const host = {
            defaultEditor,
            editor: replacementEditor,
        };

        installPromptHistoryShortcut(host, history, {
            getUserBindings: () => ({}),
        });
        replacementEditor.handleInput = (data: string): void => {
            if (data !== '\x12') {
                defaultEditor.onExtensionShortcut?.(data);
            }
        };

        replacementEditor.handleInput('\x12');

        expect(replacementEditor.activeProvider).not.to.be.instanceOf(
            PromptHistoryAutocompleteProvider
        );
    });

    it('preserves an explicit user binding for Ctrl+R', function () {
        const defaultEditor = createEditor();
        const host = {
            defaultEditor,
            editor: defaultEditor,
        };

        installPromptHistoryShortcut(host, history, {
            getUserBindings: () => ({
                'tui.editor.cursorRight': 'ctrl+r',
            }),
        });

        const handled = defaultEditor.onExtensionShortcut?.('\x12');

        expect(handled).to.equal(false);
        expect(defaultEditor.activeProvider).not.to.be.instanceOf(
            PromptHistoryAutocompleteProvider
        );
    });

    it('keeps extension shortcuts ahead of Bkper history search', function () {
        const defaultEditor = createEditor();
        const extensionShortcut = sinon.stub().returns(true);
        defaultEditor.onExtensionShortcut = extensionShortcut;
        const host = {
            defaultEditor,
            editor: defaultEditor,
        };

        installPromptHistoryShortcut(host, history, {
            getUserBindings: () => ({}),
        });

        const handled = defaultEditor.onExtensionShortcut?.('\x12');

        expect(handled).to.equal(true);
        expect(extensionShortcut.calledOnceWithExactly('\x12')).to.equal(true);
        expect(defaultEditor.activeProvider).not.to.be.instanceOf(
            PromptHistoryAutocompleteProvider
        );
    });
});
