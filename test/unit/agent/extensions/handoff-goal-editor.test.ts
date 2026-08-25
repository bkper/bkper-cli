import type {AutocompleteProvider} from '@earendil-works/pi-tui';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {PromptHistoryAutocompleteProvider} from '../../../../src/agent/interactive/prompt-history-search.js';
import {
    expandHandoffGoalTemplate,
    HANDOFF_GOAL_EDITOR_TITLE,
    installHandoffGoalEditorAutocomplete,
    installHandoffGoalEditorPromptHistory,
    type HandoffGoalEditorHost,
    type HandoffPromptTemplate,
} from '../../../../src/agent/extensions/handoff-goal-editor.js';

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

describe('handoff goal editor prompt templates', function () {
    it('expands selected slash prompts for review and expands arguments on submit', async function () {
        let autocompleteProvider: AutocompleteProvider | undefined;
        const host: HandoffGoalEditorHost = {
            showExtensionEditor: async () => {
                host.extensionEditor = {
                    editor: {
                        setAutocompleteProvider: provider => {
                            autocompleteProvider = provider;
                        },
                    },
                };
                return '/review "src/file one.ts" security';
            },
            session: {promptTemplates: templates},
            sessionManager: {getCwd: () => '/workspace/project'},
        };

        installHandoffGoalEditorAutocomplete(host);

        const unrelatedResult = await host.showExtensionEditor('Other editor');
        expect(unrelatedResult).to.equal('/review "src/file one.ts" security');
        expect(autocompleteProvider).to.equal(undefined);

        const goal = await host.showExtensionEditor(HANDOFF_GOAL_EDITOR_TITLE);
        expect(goal).to.equal(
            'Review src/file one.ts with security. First extra: security. Missing: none. All: src/file one.ts security'
        );
        expect(autocompleteProvider).to.not.equal(undefined);

        const suggestions = await autocompleteProvider?.getSuggestions(['/rev'], 0, 4, {
            signal: new AbortController().signal,
        });
        expect(suggestions).to.deep.equal({
            items: [
                {
                    value: 'review',
                    label: 'review',
                    description: '<file> [focus] — Review a file',
                },
            ],
            prefix: '',
        });

        const selected = suggestions?.items[0];
        expect(selected).to.not.equal(undefined);
        if (!selected) {
            throw new Error('Expected a slash prompt suggestion');
        }
        const completion = autocompleteProvider?.applyCompletion(
            ['/rev'],
            0,
            4,
            selected,
            suggestions.prefix
        );
        const expanded =
            'Review  with general checks. First extra: . Missing: none. All: ';
        expect(completion).to.deep.equal({
            lines: [expanded],
            cursorLine: 0,
            cursorCol: expanded.length,
        });

        const afterArgument = await autocompleteProvider?.getSuggestions(
            ['/review src/file.ts'],
            0,
            19,
            {signal: new AbortController().signal}
        );
        expect(afterArgument).to.equal(null);
    });

    it('records submitted handoff goals and searches without Bash inputs', async function () {
        let text = 'current handoff goal';
        let activeProvider: AutocompleteProvider | undefined;
        const originalHandleInput = sinon.stub();
        const requestAutocomplete = sinon.stub();
        const recorded: Array<{text: string; kind: string}> = [];
        const entries = [
            {text: '!bun test', kind: 'bash' as const, timestamp: 2},
            {text: 'reused handoff prompt', kind: 'handoff' as const, timestamp: 1},
        ];
        const host: HandoffGoalEditorHost = {
            showExtensionEditor: async () => {
                host.extensionEditor = {
                    editor: {
                        get autocompleteProvider() {
                            return activeProvider;
                        },
                        setAutocompleteProvider: provider => {
                            activeProvider = provider;
                        },
                        getText: () => text,
                        setText: value => {
                            text = value;
                        },
                        handleInput: originalHandleInput,
                        requestAutocomplete,
                        isShowingAutocomplete: () => true,
                    },
                };
                return 'submitted handoff goal';
            },
        };

        installHandoffGoalEditorPromptHistory(host, {
            getEntries: () => entries,
            record: (value, kind) => recorded.push({text: value, kind}),
        });
        installHandoffGoalEditorAutocomplete(host);

        const result = host.showExtensionEditor(HANDOFF_GOAL_EDITOR_TITLE);
        await Promise.resolve();
        host.extensionEditor?.editor?.handleInput?.('\x12');

        expect(await result).to.equal('submitted handoff goal');
        expect(activeProvider).to.be.instanceOf(PromptHistoryAutocompleteProvider);
        const suggestions = await activeProvider?.getSuggestions([''], 0, 0, {
            signal: new AbortController().signal,
        });
        expect(suggestions?.items.map(item => item.value)).to.deep.equal([
            'reused handoff prompt',
        ]);
        expect(requestAutocomplete.calledOnce).to.equal(true);
        expect(recorded).to.deep.equal([
            {text: 'submitted handoff goal', kind: 'handoff'},
        ]);
    });

    it('preserves free-form and unknown slash goals', function () {
        expect(expandHandoffGoalTemplate('Continue the current work', templates)).to.equal(
            'Continue the current work'
        );
        expect(expandHandoffGoalTemplate('/missing value', templates)).to.equal('/missing value');
    });
});
