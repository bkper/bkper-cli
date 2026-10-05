import {
    ExtensionEditorComponent,
    getAgentDir,
    type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type {AutocompleteProvider} from '@earendil-works/pi-tui';
import {CombinedAutocompleteProvider, Editor} from '../pi-shared-modules.js';
import {installPromptHistorySearch} from '../interactive/prompt-history-search.js';
import {
    FilePromptHistory,
    getPromptHistoryPath,
    type PromptHistoryRepository,
} from '../interactive/prompt-history-store.js';

export const HANDOFF_GOAL_EDITOR_TITLE = 'Next session goal';

export interface HandoffPromptTemplate {
    name: string;
    description: string;
    argumentHint?: string;
    content: string;
}

export type HandoffGoalEditorResult =
    | {status: 'submitted'; text: string}
    | {status: 'cancelled'; text: string};

export type HandoffGoalEditor = (
    prefill: string,
    context: ExtensionContext
) => Promise<HandoffGoalEditorResult>;

export interface HandoffGoalEditorOptions {
    templates?: ReadonlyArray<HandoffPromptTemplate>;
    history?: PromptHistoryRepository;
    externalEditorCommand?: string;
}

function parseCommandArgs(argsString: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote: string | undefined;

    for (const char of argsString) {
        if (inQuote) {
            if (char === inQuote) {
                inQuote = undefined;
            } else {
                current += char;
            }
        } else if (char === '"' || char === "'") {
            inQuote = char;
        } else if (/\s/.test(char)) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        args.push(current);
    }
    return args;
}

function substituteArgs(content: string, args: string[]): string {
    const allArgs = args.join(' ');

    return content.replace(
        /\$\{(\d+|ARGUMENTS|@):-([^}]*)\}|\$\{@:(\d+)(?::(\d+))?\}|\$(ARGUMENTS|@|\d+)/g,
        (_match, defaultTarget, defaultValue, sliceStart, sliceLength, simple) => {
            if (defaultTarget) {
                const value =
                    defaultTarget === '@' || defaultTarget === 'ARGUMENTS'
                        ? allArgs
                        : args[parseInt(defaultTarget, 10) - 1];
                return value || defaultValue;
            }

            if (sliceStart) {
                const start = Math.max(0, parseInt(sliceStart, 10) - 1);
                if (sliceLength) {
                    const length = parseInt(sliceLength, 10);
                    return args.slice(start, start + length).join(' ');
                }
                return args.slice(start).join(' ');
            }

            if (simple === 'ARGUMENTS' || simple === '@') {
                return allArgs;
            }
            return args[parseInt(simple, 10) - 1] ?? '';
        }
    );
}

export function expandHandoffGoalTemplate(
    goal: string,
    templates: ReadonlyArray<HandoffPromptTemplate>
): string {
    const match = goal.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
    if (!match) {
        return goal;
    }

    const template = templates.find(candidate => candidate.name === match[1]);
    if (!template) {
        return goal;
    }

    return substituteArgs(template.content, parseCommandArgs(match[2] ?? ''));
}

function createPromptTemplateAutocompleteProvider(
    templates: ReadonlyArray<HandoffPromptTemplate>,
    cwd: string
): AutocompleteProvider {
    const provider = new CombinedAutocompleteProvider(
        templates.map(template => ({
            name: template.name,
            description: template.description,
            ...(template.argumentHint ? {argumentHint: template.argumentHint} : {}),
        })),
        cwd
    );

    return {
        async getSuggestions(lines, cursorLine, cursorCol, options) {
            const textBeforeCursor = (lines[cursorLine] ?? '').slice(0, cursorCol);
            if (cursorLine !== 0 || !/^\/[^\s]*$/.test(textBeforeCursor)) {
                return null;
            }
            const suggestions = await provider.getSuggestions(
                lines,
                cursorLine,
                cursorCol,
                {...options, force: false}
            );
            return suggestions ? {...suggestions, prefix: ''} : null;
        },
        applyCompletion(lines, cursorLine, cursorCol, item) {
            const template = templates.find(candidate => candidate.name === item.value);
            if (!template) {
                return {lines, cursorLine, cursorCol};
            }
            const expandedLines = substituteArgs(template.content, []).split('\n');
            const expandedCursorLine = Math.max(0, expandedLines.length - 1);
            return {
                lines: expandedLines,
                cursorLine: expandedCursorLine,
                cursorCol: expandedLines[expandedCursorLine]?.length ?? 0,
            };
        },
        shouldTriggerFileCompletion: () => false,
    };
}

function getDialogEditor(component: ExtensionEditorComponent): Editor {
    // Use the public component tree rather than Pi's private editor field.
    const editor = component.children.find(
        (child): child is Editor => child instanceof Editor
    );
    if (!editor) throw new Error('Pi handoff dialog does not contain an editor.');
    return editor;
}

export async function editHandoffGoal(
    prefill: string,
    context: {ui: Pick<ExtensionContext['ui'], 'custom'>; cwd: string},
    options: HandoffGoalEditorOptions = {}
): Promise<HandoffGoalEditorResult> {
    const templates = [...(options.templates ?? [])];
    const history =
        options.history ?? new FilePromptHistory(getPromptHistoryPath(getAgentDir()));
    const result = await context.ui.custom<HandoffGoalEditorResult>(
        (tui, _theme, keybindings, done) => {
            const component = new ExtensionEditorComponent(
                tui,
                keybindings,
                HANDOFF_GOAL_EDITOR_TITLE,
                prefill,
                text => done({status: 'submitted', text}),
                () => done({status: 'cancelled', text: editor.getText()}),
                undefined,
                options.externalEditorCommand
            );
            const editor = getDialogEditor(component);
            editor.setAutocompleteProvider(
                createPromptTemplateAutocompleteProvider(templates, context.cwd)
            );
            installPromptHistorySearch(editor, history, false);
            return component;
        }
    );

    if (result.status === 'submitted') {
        if (result.text.trim()) history.record(result.text, 'handoff');
        return {...result, text: expandHandoffGoalTemplate(result.text, templates)};
    }
    return result;
}
