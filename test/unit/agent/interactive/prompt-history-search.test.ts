import type {AutocompleteProvider} from '@earendil-works/pi-tui';
import {KeybindingsManager, setKeybindings} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    installPromptHistoryEditor,
    PromptHistoryAutocompleteProvider,
    type PromptHistoryEditor,
} from '../../../../src/agent/interactive/prompt-history-search.js';
import type {
    PromptHistoryEntry,
    PromptHistoryRepository,
} from '../../../../src/agent/interactive/prompt-history-store.js';

const keybindings = new KeybindingsManager({
    'tui.input.submit': {defaultKeys: 'enter'},
    'tui.input.tab': {defaultKeys: 'tab'},
    'tui.select.confirm': {defaultKeys: 'enter'},
    'tui.select.cancel': {defaultKeys: 'escape'},
    'tui.select.up': {defaultKeys: 'up'},
    'tui.select.down': {defaultKeys: 'down'},
});

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

describe('prompt history search', function () {
    before(function () {
        setKeybindings(keybindings);
    });

    it('records standard submissions and opens inline autocomplete with Ctrl+R', async function () {
        let text = 'current draft';
        let activeProvider = createAutocompleteProvider();
        let showingAutocomplete = false;
        const originalProvider = activeProvider;
        const submit = sinon.stub().resolves();
        const handleInput = sinon.stub().callsFake(() => {
            showingAutocomplete = false;
        });
        const requestAutocomplete = sinon.stub().callsFake(() => {
            showingAutocomplete = true;
        });
        const record = sinon.stub();
        const entries: PromptHistoryEntry[] = [
            {text: 'current draft from history', kind: 'standard', timestamp: 1},
        ];
        const editor = {
            getText: () => text,
            setText: (value: string) => {
                text = value;
            },
            handleInput,
            onSubmit: submit,
            get autocompleteProvider() {
                return activeProvider;
            },
            setAutocompleteProvider: (provider: AutocompleteProvider) => {
                activeProvider = provider;
            },
            requestAutocomplete,
            isShowingAutocomplete: () => showingAutocomplete,
        };
        const history: PromptHistoryRepository = {
            getEntries: () => entries,
            record,
        };

        installPromptHistoryEditor(editor, history);
        await editor.onSubmit?.(' !git status ');
        editor.handleInput('\x12');

        expect(record.calledOnceWithExactly('!git status', 'bash')).to.equal(true);
        expect(submit.calledOnceWithExactly(' !git status ')).to.equal(true);
        expect(activeProvider).to.be.instanceOf(PromptHistoryAutocompleteProvider);
        expect(requestAutocomplete.calledOnceWithExactly({force: false, explicitTab: true})).to.equal(
            true
        );

        editor.handleInput('\r');
        expect(activeProvider).to.equal(originalProvider);
    });

    it('cycles inline results with repeated Ctrl+R and restores on Escape', function () {
        let activeProvider = createAutocompleteProvider();
        const originalProvider = activeProvider;
        let showingAutocomplete = false;
        const handleInput = sinon.stub().callsFake((data: string) => {
            if (data === '\x1b') {
                showingAutocomplete = false;
            }
        });
        const editor = {
            getText: () => '',
            setText: sinon.stub(),
            handleInput,
            get autocompleteProvider() {
                return activeProvider;
            },
            setAutocompleteProvider: (provider: AutocompleteProvider) => {
                activeProvider = provider;
            },
            requestAutocomplete: () => {
                showingAutocomplete = true;
            },
            isShowingAutocomplete: () => showingAutocomplete,
        };
        const history: PromptHistoryRepository = {
            getEntries: () => [
                {text: 'latest prompt', kind: 'standard', timestamp: 2},
                {text: 'older prompt', kind: 'standard', timestamp: 1},
            ],
            record: sinon.stub(),
        };

        installPromptHistoryEditor(editor, history);
        editor.handleInput('\x12');
        editor.handleInput('\x12');
        expect(handleInput.calledOnceWithExactly('\x1b[B')).to.equal(true);

        editor.handleInput('\x1b');
        expect(activeProvider).to.equal(originalProvider);

        handleInput.resetHistory();
        editor.handleInput('\x1b\x12');
        expect(handleInput.calledOnceWithExactly('\x1b\x12')).to.equal(true);
    });

    it('uses compact labels while applying the complete multiline prompt', async function () {
        const entries: PromptHistoryEntry[] = [
            {
                text: 'latest\nmultiline prompt',
                kind: 'standard',
                timestamp: 2,
            },
            {text: '!bun test', kind: 'bash', timestamp: 1},
        ];
        const provider = new PromptHistoryAutocompleteProvider(entries, false);

        const suggestions = await provider.getSuggestions(['latest'], 0, 6, {
            signal: new AbortController().signal,
        });
        expect(suggestions).to.deep.equal({
            items: [
                {
                    value: 'latest\nmultiline prompt',
                    label: 'latest multiline prompt',
                },
            ],
            prefix: '',
        });

        const applied = provider.applyCompletion(
            ['latest'],
            0,
            6,
            suggestions?.items[0] ?? {value: '', label: ''},
            ''
        );
        expect(applied).to.deep.equal({
            lines: ['latest', 'multiline prompt'],
            cursorLine: 1,
            cursorCol: 16,
        });
    });
});
