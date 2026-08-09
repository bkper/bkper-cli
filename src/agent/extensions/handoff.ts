import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
import { matchesKey, type KeyId, type SettingItem } from '@earendil-works/pi-tui';

export const AUTO_HANDOFF_LEAD_TOKENS = 8192;
const BKPER_HANDOFF_SHORTCUT: KeyId = 'ctrl+h';
const AUTO_HANDOFF_SETTING_ID = 'auto-handoff';
const AUTO_HANDOFF_THRESHOLD_ENV_VAR = 'BKPER_AUTO_HANDOFF_THRESHOLD_TOKENS';
const DEFAULT_AUTO_HANDOFF_GOAL = 'Continue the current work';
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

export interface AutoHandoffSettings {
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
}

export interface HandoffGenerationRequest {
    conversation: string;
    goal?: string;
}

export interface HandoffDependencies {
    generatePrompt(request: HandoffGenerationRequest, context: ExtensionContext): Promise<string>;
}

export type HandoffCommandDispatcher = (command: string) => Promise<void>;

export interface MutableSettingsList {
    items: SettingItem[];
    filteredItems: SettingItem[];
    onChange(id: string, newValue: string): void;
}

export interface AutoHandoffSettingsHost {
    showSettingsSelector(): void;
    editorContainer: {
        children: unknown[];
    };
}

type KeybindingsConfigValue = string | string[] | undefined;
type KeybindingsConfig = Record<string, KeybindingsConfigValue>;

export interface BkperHandoffShortcutHost {
    defaultEditor: {
        onExtensionShortcut?: (data: string) => boolean;
    };
    keybindings: {
        getResolvedBindings(): KeybindingsConfig;
    };
    session: {
        prompt(text: string): Promise<void>;
    };
}

type GenerationOutcome =
    | { status: 'completed'; text: string }
    | { status: 'cancelled' }
    | { status: 'failed'; error: Error };

type StoredBkperSettings = {
    autoHandoff?: {
        enabled?: boolean;
    };
    [key: string]: unknown;
};

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

export function installBkperHandoffShortcut(host: BkperHandoffShortcutHost): void {
    const shortcut = getBkperHandoffShortcut(host.keybindings.getResolvedBindings());
    if (!shortcut) {
        return;
    }

    const originalShortcut = host.defaultEditor.onExtensionShortcut;
    host.defaultEditor.onExtensionShortcut = data => {
        if (originalShortcut?.call(host.defaultEditor, data)) {
            return true;
        }
        if (!matchesKey(data, shortcut)) {
            return false;
        }

        // Session prompt dispatch executes extension commands immediately, even mid-turn.
        void host.session.prompt('/handoff');
        return true;
    };
}

function readStoredSettings(filePath: string): StoredBkperSettings {
    try {
        const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
        if (!isRecord(parsed)) {
            return {};
        }

        const autoHandoff = parsed.autoHandoff;
        return {
            ...parsed,
            autoHandoff: isRecord(autoHandoff)
                ? {
                      ...autoHandoff,
                      enabled:
                          typeof autoHandoff.enabled === 'boolean'
                              ? autoHandoff.enabled
                              : undefined,
                  }
                : undefined,
        };
    } catch (error) {
        const code = isRecord(error) ? error.code : undefined;
        if (code === 'ENOENT' || error instanceof SyntaxError) {
            return {};
        }
        throw error;
    }
}

export function calculateAutoHandoffThreshold(
    contextWindow: number,
    reserveTokens: number
): number {
    return Math.max(0, contextWindow - reserveTokens - AUTO_HANDOFF_LEAD_TOKENS);
}

export function getHandoffReminderThreshold(lastPromptTokens: number): number {
    return lastPromptTokens + AUTO_HANDOFF_LEAD_TOKENS;
}

function getAutoHandoffThresholdOverride(
    env: Record<string, string | undefined>
): number | undefined {
    const configured = env[AUTO_HANDOFF_THRESHOLD_ENV_VAR];
    if (configured === undefined) {
        return undefined;
    }

    const threshold = Number(configured);
    if (configured.trim() === '' || !Number.isSafeInteger(threshold) || threshold < 0) {
        throw new Error(`${AUTO_HANDOFF_THRESHOLD_ENV_VAR} must be a non-negative integer.`);
    }
    return threshold;
}

function insertSetting(items: SettingItem[], setting: SettingItem): void {
    if (items.some(item => item.id === setting.id)) {
        return;
    }
    const autoCompactIndex = items.findIndex(item => item.id === 'autocompact');
    items.splice(autoCompactIndex >= 0 ? autoCompactIndex : 0, 0, setting);
}

export function addAutoHandoffSetting(
    settingsList: MutableSettingsList,
    settings: AutoHandoffSettings
): void {
    const setting: SettingItem = {
        id: AUTO_HANDOFF_SETTING_ID,
        label: 'Auto-handoff',
        description: 'Offer a focused new session shortly before context compaction',
        currentValue: settings.isEnabled() ? 'true' : 'false',
        values: ['true', 'false'],
    };
    insertSetting(settingsList.items, setting);
    if (settingsList.filteredItems !== settingsList.items) {
        insertSetting(settingsList.filteredItems, setting);
    }

    const originalOnChange = settingsList.onChange.bind(settingsList);
    settingsList.onChange = (id, newValue) => {
        if (id === AUTO_HANDOFF_SETTING_ID) {
            settings.setEnabled(newValue === 'true');
            return;
        }
        originalOnChange(id, newValue);
    };
}

function hasSettingsList(value: unknown): value is { getSettingsList(): MutableSettingsList } {
    return isRecord(value) && typeof value.getSettingsList === 'function';
}

export function installAutoHandoffSettingsIntegration(
    host: AutoHandoffSettingsHost,
    settings: AutoHandoffSettings
): void {
    const showSettingsSelector = host.showSettingsSelector.bind(host);
    host.showSettingsSelector = () => {
        showSettingsSelector();
        const selector = host.editorContainer.children.find(hasSettingsList);
        if (selector) {
            addAutoHandoffSetting(selector.getSettingsList(), settings);
        }
    };
}

export function getAutoHandoffSettingsPath(agentDir: string): string {
    return path.join(agentDir, 'bkper-settings.json');
}

export class FileAutoHandoffSettings implements AutoHandoffSettings {
    constructor(private readonly filePath: string) {}

    isEnabled(): boolean {
        return readStoredSettings(this.filePath).autoHandoff?.enabled ?? true;
    }

    setEnabled(enabled: boolean): void {
        const current = readStoredSettings(this.filePath);
        const next: StoredBkperSettings = {
            ...current,
            autoHandoff: {
                ...current.autoHandoff,
                enabled,
            },
        };
        mkdirSync(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
        try {
            writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
            renameSync(temporaryPath, this.filePath);
        } finally {
            rmSync(temporaryPath, { force: true });
        }
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
    pi: Pick<ExtensionAPI, 'on' | 'registerCommand'>,
    settings: AutoHandoffSettings,
    reserveTokens: () => number,
    dependencies: HandoffDependencies = defaultDependencies,
    env: Record<string, string | undefined> = process.env,
    dispatchCommand?: HandoffCommandDispatcher
): void {
    const thresholdOverride = getAutoHandoffThresholdOverride(env);
    let lastPromptTokens: number | undefined;
    let pendingGoalPrefill: string | undefined;

    const resetAutomaticState = () => {
        lastPromptTokens = undefined;
        pendingGoalPrefill = undefined;
    };

    pi.on('session_start', resetAutomaticState);
    pi.on('session_compact', resetAutomaticState);

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
                const editedGoal = await context.ui.editor('Handoff goal', goalPrefill);
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

    pi.on('agent_settled', async (_event, context) => {
        if (context.mode !== 'tui' || !settings.isEnabled() || !context.model) {
            return;
        }
        const usage = context.getContextUsage();
        if (!usage || usage.tokens === null) {
            return;
        }
        const threshold =
            lastPromptTokens === undefined
                ? (thresholdOverride ??
                  calculateAutoHandoffThreshold(usage.contextWindow, reserveTokens()))
                : getHandoffReminderThreshold(lastPromptTokens);
        if (usage.tokens < threshold) {
            return;
        }
        lastPromptTokens = usage.tokens;

        if (!dispatchCommand) {
            context.ui.notify('Automatic handoff command dispatch is unavailable.', 'error');
            return;
        }

        pendingGoalPrefill = DEFAULT_AUTO_HANDOFF_GOAL;
        void dispatchCommand('/handoff').catch(error => {
            pendingGoalPrefill = undefined;
            context.ui.notify(`Automatic handoff failed: ${normalizeError(error).message}`, 'error');
        });
    });
}
