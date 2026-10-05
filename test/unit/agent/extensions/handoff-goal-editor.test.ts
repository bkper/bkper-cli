import {
    ExtensionEditorComponent,
    initTheme,
    type ExtensionUIContext,
    type KeybindingsManager,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import type {AutocompleteProvider, Component, Editor, TUI} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {PromptHistoryAutocompleteProvider} from '../../../../src/agent/interactive/prompt-history-search.js';
import {
    editHandoffGoal,
    expandHandoffGoalTemplate,
    type HandoffGoalEditorResult,
    type HandoffPromptTemplate,
} from '../../../../src/agent/extensions/handoff-goal-editor.js';
import type {PromptHistoryEntry} from '../../../../src/agent/interactive/prompt-history-store.js';

const templates: HandoffPromptTemplate[] = [
    {
        name: 'review',
        description: 'Review a file',
        argumentHint: '<file> [focus]',
        content:
            'Review $1 with ${2:-general checks}. First extra: ${@:2:1}. Missing: ${3:-none}. All: $ARGUMENTS',
    },
    {
        name: 'finish',
        description: 'Finish the current task',
        content: 'Finish the current task',
    },
];

type TestEditor = Pick<Editor, 'getText' | 'setText' | 'handleInput' | 'render'> & {
    autocompleteProvider: AutocompleteProvider;
};

function openGoalEditor(prefill: string, entries: PromptHistoryEntry[] = []) {
    initTheme('dark', false);
    let dialog: ExtensionEditorComponent | undefined;
    const record = sinon.stub();
    const requestRender = sinon.stub();
    const tui = {
        terminal: {rows: 30, columns: 100},
        requestRender,
    } as unknown as TUI;
    const keybindings = {matches: () => false} as unknown as KeybindingsManager;
    const custom: ExtensionUIContext['custom'] = <T>(
        factory: (
            tui: TUI,
            theme: Theme,
            keybindings: KeybindingsManager,
            done: (result: T) => void
        ) => Component | Promise<Component>
    ) => new Promise<T>((resolve, reject) => {
        const created = factory(tui, {} as Theme, keybindings, resolve);
        if (!(created instanceof ExtensionEditorComponent)) {
            reject(new Error('Expected the synchronous Pi editor component'));
            return;
        }
        dialog = created;
    });
    const result = editHandoffGoal(prefill, {ui: {custom}, cwd: '/workspace/project'}, {
        templates,
        history: {getEntries: () => entries, record},
    });
    if (!dialog) throw new Error('Goal editor did not open');
    // Exercise the actual Pi component used by the adapter, including its embedded editor.
    const editor = (dialog as unknown as {editor: TestEditor}).editor;
    return {result, dialog, editor, record, requestRender};
}

describe('handoff goal editor result contract', function () {
    for (const cancelKey of ['\x1b', '\x03']) {
        for (const latestDraft of ['text for handoff', '  edited\nsecond line  ', '', '/finish']) {
            it(`returns the latest cancelled draft ${JSON.stringify(latestDraft)} with ${JSON.stringify(cancelKey)}`, async function () {
                const {result, dialog, editor, record} = openGoalEditor('Original input');
                expect(editor.getText()).to.equal('Original input');
                editor.setText(latestDraft);

                dialog.handleInput(cancelKey);

                expect(await result).to.deep.equal({status: 'cancelled', text: latestDraft});
                expect(record.called).to.equal(false);
            });
        }
    }

    it('returns and records submitted text separately from cancellation', async function () {
        const {result, dialog, editor, record} = openGoalEditor('Original input');
        editor.setText('Continue the work');

        dialog.handleInput('\r');

        const outcome: HandoffGoalEditorResult = await result;
        expect(outcome).to.deep.equal({status: 'submitted', text: 'Continue the work'});
        expect(record.calledOnceWithExactly('Continue the work', 'handoff')).to.equal(true);
    });
});

describe('handoff goal editor prompt templates', function () {
    it('expands selected slash prompts and expands arguments on submit', async function () {
        const {result, dialog, editor, record} = openGoalEditor('');
        const provider = editor.autocompleteProvider;
        const suggestions = await provider.getSuggestions(['/rev'], 0, 4, {
            signal: new AbortController().signal,
        });
        expect(suggestions?.items.map(item => item.value)).to.deep.equal(['review']);
        expect(suggestions?.prefix).to.equal('');
        const selected = suggestions?.items[0];
        if (!selected || !suggestions) throw new Error('Expected a slash prompt suggestion');
        const completion = provider.applyCompletion(['/rev'], 0, 4, selected, suggestions.prefix);
        const expanded = 'Review  with general checks. First extra: . Missing: none. All: ';
        expect(completion).to.deep.equal({
            lines: [expanded],
            cursorLine: 0,
            cursorCol: expanded.length,
        });
        expect(await provider.getSuggestions(['/review src/file.ts'], 0, 19, {
            signal: new AbortController().signal,
        })).to.equal(null);
        editor.setText('/review "src/file one.ts" security');

        dialog.handleInput('\r');

        expect(await result).to.deep.equal({
            status: 'submitted',
            text: 'Review src/file one.ts with security. First extra: security. Missing: none. All: src/file one.ts security',
        });
        expect(record.calledOnceWithExactly('/review "src/file one.ts" security', 'handoff')).to.equal(true);
    });

    it('searches prompt history without Bash inputs and records submitted goals', async function () {
        const {result, dialog, editor, record, requestRender} = openGoalEditor('', [
            {text: '!bun test', kind: 'bash', timestamp: 2},
            {text: 'reused handoff prompt', kind: 'handoff', timestamp: 1},
        ]);
        // Rendering establishes the real editor's cursor and completion dimensions.
        dialog.render(100);
        await new Promise<void>(resolve => {
            requestRender.callsFake(() => resolve());
            dialog.handleInput('\x12');
        });
        expect(editor.autocompleteProvider).to.be.instanceOf(PromptHistoryAutocompleteProvider);
        const suggestions = await editor.autocompleteProvider.getSuggestions([''], 0, 0, {
            signal: new AbortController().signal,
        });
        expect(suggestions?.items.map(item => item.value)).to.deep.equal(['reused handoff prompt']);
        // Enter accepts the history completion before a subsequent Enter submits.
        dialog.handleInput('\r');
        editor.setText('submitted handoff goal');

        dialog.handleInput('\r');

        expect(await result).to.deep.equal({status: 'submitted', text: 'submitted handoff goal'});
        expect(record.calledOnceWithExactly('submitted handoff goal', 'handoff')).to.equal(true);
    });

    it('preserves free-form and unknown slash goals', function () {
        expect(expandHandoffGoalTemplate('Continue the current work', templates)).to.equal(
            'Continue the current work'
        );
        expect(expandHandoffGoalTemplate('/missing value', templates)).to.equal('/missing value');
    });
});
