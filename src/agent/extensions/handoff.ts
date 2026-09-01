import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import {
    BorderedLoader,
    convertToLlm,
    serializeConversation,
    type ExtensionAPI,
    type ExtensionCommandContext,
    type ExtensionContext,
    type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { type KeyId } from '@earendil-works/pi-tui';
import { HANDOFF_GOAL_EDITOR_TITLE } from './handoff-goal-editor.js';

const BKPER_HANDOFF_SHORTCUT: KeyId = 'ctrl+h';
const MAX_SESSION_NAME_LENGTH = 80;

const HANDOFF_SYSTEM_PROMPT = `You are a context transfer assistant. Given a conversation history and the user's goal for a new thread, generate a focused prompt that:

1. Summarizes only the context relevant to the goal, including decisions, approaches, and key findings.
2. Lists relevant files that were discussed, read, or modified.
3. Clearly states the next task based on the user's goal.
4. Includes important constraints, unresolved questions, and verification status.
5. Is self-contained so the new session can proceed without the old conversation.

Format the response as a concise prompt for the new session. Do not include a preamble such as "Here's the prompt".

Use this structure:
## Context
[Relevant context and decisions]

## Files
[Relevant files, or "None identified"]

## Task
[Concrete next task]

## Constraints
[Important constraints and verification status]`;

export interface HandoffGenerationRequest {
    conversation: string;
    goal?: string;
}

export interface HandoffDependencies {
    generatePrompt(request: HandoffGenerationRequest, context: ExtensionContext): Promise<string>;
}

export type HandoffCommandDispatcher = (command: string) => Promise<void>;

type KeybindingsConfigValue = string | string[] | undefined;
type KeybindingsConfig = Record<string, KeybindingsConfigValue>;

type GenerationOutcome =
    | { status: 'completed'; text: string }
    | { status: 'cancelled' }
    | { status: 'failed'; error: Error };

class HandoffCancelledError extends Error {}

function normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function isShortcutClaimedByBindings(bindings: KeybindingsConfig, shortcut: string): boolean {
    return Object.values(bindings).some(binding =>
        keybindingConfigIncludesShortcut(binding, shortcut)
    );
}

export function getBkperHandoffShortcut(bindings: KeybindingsConfig): KeyId | undefined {
    return isShortcutClaimedByBindings(bindings, BKPER_HANDOFF_SHORTCUT)
        ? undefined
        : BKPER_HANDOFF_SHORTCUT;
}

export function getBkperHandoffShortcutFromFile(agentDir: string): KeyId | undefined {
    try {
        const parsed: unknown = JSON.parse(
            readFileSync(path.join(agentDir, 'keybindings.json'), 'utf8')
        );
        if (!isRecord(parsed)) {
            return BKPER_HANDOFF_SHORTCUT;
        }

        const bindings: KeybindingsConfig = {};
        for (const [keybinding, binding] of Object.entries(parsed)) {
            if (typeof binding === 'string') {
                bindings[keybinding] = binding;
            } else if (
                Array.isArray(binding) &&
                binding.every(shortcut => typeof shortcut === 'string')
            ) {
                bindings[keybinding] = binding;
            }
        }
        return getBkperHandoffShortcut(bindings);
    } catch {
        return BKPER_HANDOFF_SHORTCUT;
    }
}

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
    if (entry.type === 'message') {
        return entry.message;
    }
    if (entry.type === 'compaction') {
        return {
            role: 'compactionSummary',
            summary: entry.summary,
            tokensBefore: entry.tokensBefore,
            timestamp: new Date(entry.timestamp).getTime(),
        };
    }
    return undefined;
}

function contextMessages(context: ExtensionContext): AgentMessage[] {
    return context.sessionManager
        .buildContextEntries()
        .map(entryToMessage)
        .filter(message => message !== undefined);
}

function serializeCurrentConversation(context: ExtensionContext): string {
    return serializeConversation(convertToLlm(contextMessages(context)));
}

async function generateWithCurrentModel(
    context: ExtensionContext,
    systemPrompt: string,
    prompt: string,
    loadingMessage: string
): Promise<string> {
    if (!context.model) {
        throw new Error('No model selected.');
    }

    const outcome = await context.ui.custom<GenerationOutcome>((tui, theme, _keybindings, done) => {
        const loader = new BorderedLoader(tui, theme, loadingMessage);
        loader.onAbort = () => done({ status: 'cancelled' });

        void context.modelRegistry
            .complete(
                context.model!,
                {
                    systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: [{ type: 'text', text: prompt }],
                            timestamp: Date.now(),
                        },
                    ],
                },
                {
                    signal: loader.signal,
                    cacheRetention: 'none',
                    sessionId: randomUUID(),
                }
            )
            .then(response => {
                if (response.stopReason === 'aborted') {
                    done({ status: 'cancelled' });
                    return;
                }
                if (response.stopReason === 'error') {
                    done({
                        status: 'failed',
                        error: new Error(response.errorMessage ?? 'Handoff generation failed.'),
                    });
                    return;
                }
                const text = response.content
                    .filter(
                        (content): content is { type: 'text'; text: string } =>
                            content.type === 'text'
                    )
                    .map(content => content.text)
                    .join('\n')
                    .trim();
                if (!text) {
                    done({ status: 'failed', error: new Error('Handoff generation was empty.') });
                    return;
                }
                done({ status: 'completed', text });
            })
            .catch(error => done({ status: 'failed', error: normalizeError(error) }));

        return loader;
    });

    if (outcome.status === 'cancelled') {
        throw new HandoffCancelledError('Handoff cancelled.');
    }
    if (outcome.status === 'failed') {
        throw outcome.error;
    }
    return outcome.text;
}

const defaultDependencies: HandoffDependencies = {
    generatePrompt: (request, context) =>
        generateWithCurrentModel(
            context,
            HANDOFF_SYSTEM_PROMPT,
            `## Conversation History\n\n${request.conversation}\n\n## Goal for New Session\n\n${
                request.goal ?? ''
            }`,
            'Preparing handoff...'
        ),
};

function sessionNameFromGoal(goal: string): string {
    const normalized = goal.replace(/\s+/g, ' ').trim();
    if (normalized.length <= MAX_SESSION_NAME_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_SESSION_NAME_LENGTH - 1).trimEnd()}…`;
}

async function performHandoff(
    goal: string,
    context: ExtensionCommandContext,
    dependencies: HandoffDependencies
): Promise<void> {
    const conversation = serializeCurrentConversation(context);
    if (!conversation) {
        context.ui.notify('No conversation to hand off.', 'warning');
        return;
    }

    let prompt: string;
    try {
        prompt = await dependencies.generatePrompt({ conversation, goal }, context);
    } catch (error) {
        if (error instanceof HandoffCancelledError) {
            context.ui.notify('Handoff cancelled.', 'info');
            return;
        }
        context.ui.notify(`Handoff failed: ${normalizeError(error).message}`, 'error');
        return;
    }

    const parentSession = context.sessionManager.getSessionFile();
    const result = await context.newSession({
        parentSession,
        setup: async sessionManager => {
            sessionManager.appendSessionInfo(sessionNameFromGoal(goal));
        },
        withSession: async replacementContext => {
            replacementContext.ui.setEditorText(prompt);
            replacementContext.ui.notify('Handoff ready. Submit when ready.', 'info');
        },
    });
    if (result.cancelled) {
        context.ui.notify('Handoff cancelled.', 'info');
    }
}

export function registerBkperHandoffExtension(
    pi: Pick<ExtensionAPI, 'registerCommand' | 'registerShortcut'>,
    dispatchCommand?: HandoffCommandDispatcher,
    handoffShortcut?: KeyId,
    dependencies: HandoffDependencies = defaultDependencies
): void {
    let pendingGoalPrefill: string | undefined;

    if (handoffShortcut) {
        pi.registerShortcut(handoffShortcut, {
            description: 'Continue the current work in a focused new session',
            handler: async context => {
                if (!dispatchCommand) {
                    context.ui.notify('Handoff shortcut dispatch is unavailable.', 'error');
                    return;
                }
                pendingGoalPrefill = context.ui.getEditorText();
                try {
                    await dispatchCommand('/handoff');
                } catch (error) {
                    pendingGoalPrefill = undefined;
                    context.ui.notify(
                        `Handoff shortcut failed: ${normalizeError(error).message}`,
                        'error'
                    );
                }
            },
        });
    }

    pi.registerCommand('handoff', {
        description: 'Continue the current work in a focused new session',
        handler: async (args, context) => {
            if (context.mode !== 'tui') {
                context.ui.notify('Handoff requires interactive mode.', 'error');
                return;
            }
            if (!context.model) {
                context.ui.notify('No model selected.', 'error');
                return;
            }

            let goal = args.trim();
            if (!goal) {
                const goalPrefill = pendingGoalPrefill ?? '';
                pendingGoalPrefill = undefined;
                const editedGoal = await context.ui.editor(
                    HANDOFF_GOAL_EDITOR_TITLE,
                    goalPrefill
                );
                if (editedGoal === undefined || !editedGoal.trim()) {
                    context.ui.notify('Handoff cancelled.', 'info');
                    return;
                }
                goal = editedGoal.trim();
            }

            await context.waitForIdle();
            await performHandoff(goal, context, dependencies);
        },
    });
}
