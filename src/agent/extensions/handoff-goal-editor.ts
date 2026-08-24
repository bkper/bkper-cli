import {
    CombinedAutocompleteProvider,
    type AutocompleteProvider,
} from '@earendil-works/pi-tui';

export const HANDOFF_GOAL_EDITOR_TITLE = 'Next session goal';

export interface HandoffPromptTemplate {
    name: string;
    description: string;
    argumentHint?: string;
    content: string;
}

interface HandoffGoalEditor {
    setAutocompleteProvider(provider: AutocompleteProvider): void;
}

export interface HandoffGoalEditorHost {
    showExtensionEditor(title: string, prefill?: string): Promise<string | undefined>;
    extensionEditor?: {
        editor?: HandoffGoalEditor;
    };
    session?: {
        promptTemplates: ReadonlyArray<HandoffPromptTemplate>;
    };
    sessionManager?: {
        getCwd(): string;
    };
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
            return provider.getSuggestions(lines, cursorLine, cursorCol, {
                ...options,
                force: false,
            });
        },
        applyCompletion: (lines, cursorLine, cursorCol, item, prefix) =>
            provider.applyCompletion(lines, cursorLine, cursorCol, item, prefix),
        shouldTriggerFileCompletion: () => false,
    };
}

export function installHandoffGoalEditorAutocomplete(host: HandoffGoalEditorHost): void {
    const showExtensionEditor = host.showExtensionEditor.bind(host);

    host.showExtensionEditor = async (title, prefill) => {
        if (title !== HANDOFF_GOAL_EDITOR_TITLE) {
            return showExtensionEditor(title, prefill);
        }

        const templates = [...(host.session?.promptTemplates ?? [])];
        const result = showExtensionEditor(title, prefill);
        const editor = host.extensionEditor?.editor;
        if (editor) {
            editor.setAutocompleteProvider(
                createPromptTemplateAutocompleteProvider(
                    templates,
                    host.sessionManager?.getCwd() ?? process.cwd()
                )
            );
        }

        const goal = await result;
        return goal === undefined ? undefined : expandHandoffGoalTemplate(goal, templates);
    };
}
