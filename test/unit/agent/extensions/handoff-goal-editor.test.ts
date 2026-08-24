import type {AutocompleteProvider} from '@earendil-works/pi-tui';
import {expect} from '../../helpers/test-setup.js';
import {
    expandHandoffGoalTemplate,
    HANDOFF_GOAL_EDITOR_TITLE,
    installHandoffGoalEditorAutocomplete,
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
    it('adds prompt-only slash autocomplete and expands arguments on submit', async function () {
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
            prefix: '/rev',
        });

        const afterArgument = await autocompleteProvider?.getSuggestions(
            ['/review src/file.ts'],
            0,
            19,
            {signal: new AbortController().signal}
        );
        expect(afterArgument).to.equal(null);
    });

    it('preserves free-form and unknown slash goals', function () {
        expect(expandHandoffGoalTemplate('Continue the current work', templates)).to.equal(
            'Continue the current work'
        );
        expect(expandHandoffGoalTemplate('/missing value', templates)).to.equal('/missing value');
    });
});
