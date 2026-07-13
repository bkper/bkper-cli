import {
    createAgentSessionFromServices,
    createAgentSessionRuntime,
    createAgentSessionServices,
    getAgentDir,
    InteractiveMode,
    keyText,
    SessionManager,
    SettingsManager,
    type AgentSessionRuntimeDiagnostic,
    type CreateAgentSessionRuntimeFactory,
    type Extension,
    type ExtensionAPI,
    type LoadExtensionsResult,
    type ProviderConfig,
    type Theme,
} from '@earendil-works/pi-coding-agent';
import { VERSION as PI_VERSION } from '@earendil-works/pi-coding-agent';
import { registerBkperCoreConceptsPreloadExtension } from './core-concepts-preload.js';
import { runStartupMaintenance } from './startup-maintenance.js';
import { getBkperAgentSystemPrompt } from './system-prompt.js';

export type InteractiveRuntimeHost = ConstructorParameters<typeof InteractiveMode>[0];

type NotificationType = 'info' | 'warning' | 'error';
type ScopedThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

type StartupHeaderComponent = {
    render: (width: number) => string[];
    invalidate: () => void;
    dispose?: () => void;
};

type StartupHeaderFactory = (_tui: unknown, theme: Theme) => StartupHeaderComponent;

type StartupExtensionAPI = Pick<ExtensionAPI, 'on'>;
type ProviderRegistrationAPI = Pick<ExtensionAPI, 'registerProvider'>;

type ExtensionLoadError = {
    path: string;
    error: string;
};

// Pi currently labels inline extension factories as <inline:N>.
// Keep Bkper's label synthetic too: Pi resolves plain extension paths as files.
const INLINE_EXTENSION_PATH_PATTERN = /^<inline:\d+>$/;
export const BKPER_AGENT_BUILTINS_EXTENSION_NAME = 'Bkper Agent built-ins';
export const BKPER_AGENT_BUILTINS_EXTENSION_PATH = '<inline:bkper-agent-builtins>';
const BUILT_IN_BKPER_AGENT_FEATURE_ERROR = `${BKPER_AGENT_BUILTINS_EXTENSION_NAME} failed to start.`;

type SettingsError = {
    scope: 'global' | 'project';
    error: Error;
};

type SettingsManagerLike = {
    drainErrors(): SettingsError[];
    getSessionDir(): string | undefined;
    getEnabledModels(): string[] | undefined;
    getDefaultProvider(): string | undefined;
    getDefaultModel(): string | undefined;
    getQuietStartup(): boolean;
};

type ModelLike = {
    provider: string;
    id: string;
};

type ModelRegistryLike<TModel extends ModelLike = ModelLike> = {
    getAvailable(): TModel[];
    find(provider: string, modelId: string): TModel | undefined;
};

type SessionManagerLike = {
    buildSessionContext(): {
        messages: unknown[];
    };
};

type KeybindingsConfigValue = string | string[] | undefined;

type KeybindingsConfigLike = Record<string, KeybindingsConfigValue>;

export type BkperKeybindingsManager = {
    getUserBindings(): KeybindingsConfigLike;
    setUserBindings(userBindings: KeybindingsConfigLike): void;
    reload(): void;
};

type ScopedModel<TModel extends ModelLike = ModelLike> = {
    model: TModel;
    thinkingLevel?: ScopedThinkingLevel;
};

export interface RestoredPersistedSessionOptions<TModel extends ModelLike = ModelLike> {
    model?: TModel;
    thinkingLevel?: ScopedThinkingLevel;
    scopedModels: Array<ScopedModel<TModel>>;
    diagnostics: AgentSessionRuntimeDiagnostic[];
}

const PI_RESUME_HINT_TEXT = 'To resume this session:';
const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g;

function isPiResumeHintOutput(chunk: string): boolean {
    return chunk.replace(ANSI_PATTERN, '').trimStart().startsWith(PI_RESUME_HINT_TEXT);
}

export function suppressPiResumeHintOutput(): () => void {
    const originalWrite = process.stdout.write;

    process.stdout.write = function (
        this: typeof process.stdout,
        chunk: string | Uint8Array,
        encoding?: BufferEncoding,
        callback?: (err?: Error | null) => void
    ): boolean {
        if (typeof chunk === 'string' && isPiResumeHintOutput(chunk)) {
            return true;
        }

        return originalWrite.call(this, chunk, encoding, callback);
    } as typeof process.stdout.write;

    return () => {
        process.stdout.write = originalWrite;
    };
}

export class BkperInteractiveMode extends InteractiveMode {
    async init(): Promise<void> {
        const interactiveMode = this as unknown as {
            getChangelogForDisplay: () => undefined;
            keybindings?: BkperKeybindingsManager;
        };
        interactiveMode.getChangelogForDisplay = () => undefined;

        if (interactiveMode.keybindings) {
            installBkperSessionKeybindings(interactiveMode.keybindings);
        }

        await super.init();
    }

    async run(): Promise<void> {
        const restoreResumeHintOutput = suppressPiResumeHintOutput();

        try {
            await super.run();
        } finally {
            restoreResumeHintOutput();
        }
    }
}

export interface AgentModeDependencies {
    createRuntime: () => Promise<{
        runtime: InteractiveRuntimeHost;
        modelFallbackMessage?: string;
        diagnostics?: AgentSessionRuntimeDiagnostic[];
    }>;
    createInteractiveMode: (
        runtime: InteractiveRuntimeHost,
        modelFallbackMessage?: string
    ) => {
        run(): Promise<void>;
    };
}

export function collectSettingsDiagnostics(
    settingsManager: Pick<SettingsManagerLike, 'drainErrors'>,
    context: string
): AgentSessionRuntimeDiagnostic[] {
    return settingsManager.drainErrors().map(({ scope, error }) => ({
        type: 'warning',
        message: `(${context}, ${scope} settings) ${error.message}`,
    }));
}

export function createStartupSessionManager<TSessionManager>(
    cwd: string,
    settingsManager: Pick<SettingsManagerLike, 'getSessionDir'>,
    createSessionManager: (cwd: string, sessionDir?: string) => TSessionManager
): TSessionManager {
    return createSessionManager(cwd, settingsManager.getSessionDir());
}

function isSameModel(left: ModelLike, right: ModelLike): boolean {
    return left.provider === right.provider && left.id === right.id;
}

function isThinkingLevel(value: string): value is ScopedThinkingLevel {
    return ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(value);
}

function findExactModelMatch<TModel extends ModelLike>(
    modelReference: string,
    availableModels: TModel[]
): TModel[] {
    const trimmedReference = modelReference.trim();
    if (!trimmedReference) {
        return [];
    }

    const normalizedReference = trimmedReference.toLowerCase();
    const canonicalMatches = availableModels.filter(
        model => `${model.provider}/${model.id}`.toLowerCase() === normalizedReference
    );

    if (canonicalMatches.length > 0) {
        return canonicalMatches;
    }

    const idMatches = availableModels.filter(
        model => model.id.toLowerCase() === normalizedReference
    );
    return idMatches.length === 1 ? idMatches : [];
}

function hasWildcard(pattern: string): boolean {
    return pattern.includes('*') || pattern.includes('?');
}

function escapeRegExp(value: string): string {
    return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
    let regex = '^';

    for (const char of pattern) {
        if (char === '*') {
            regex += '.*';
            continue;
        }

        if (char === '?') {
            regex += '.';
            continue;
        }

        regex += escapeRegExp(char);
    }

    regex += '$';
    return new RegExp(regex, 'i');
}

function getBkperAiDefaultThinkingLevel(model: ModelLike): ScopedThinkingLevel | undefined {
    if (model.provider !== BKPER_AI_PROVIDER_ID) {
        return undefined;
    }
    return model.id === 'openai/gpt-5.6-sol' ? 'medium' : undefined;
}

function resolvePatternMatches<TModel extends ModelLike>(
    rawPattern: string,
    availableModels: TModel[]
): {
    matches: TModel[];
    thinkingLevel?: ScopedThinkingLevel;
} {
    const exactMatches = findExactModelMatch(rawPattern, availableModels);
    if (exactMatches.length > 0) {
        return { matches: exactMatches };
    }

    let pattern = rawPattern.trim();
    let thinkingLevel: ScopedThinkingLevel | undefined;

    const lastColonIndex = pattern.lastIndexOf(':');
    if (lastColonIndex !== -1) {
        const suffix = pattern.substring(lastColonIndex + 1).trim();
        if (isThinkingLevel(suffix)) {
            thinkingLevel = suffix;
            pattern = pattern.substring(0, lastColonIndex).trim();
        }
    }

    const exactPatternMatches = findExactModelMatch(pattern, availableModels);
    if (exactPatternMatches.length > 0) {
        return {
            matches: exactPatternMatches,
            thinkingLevel,
        };
    }

    if (!hasWildcard(pattern)) {
        return {
            matches: [],
            thinkingLevel,
        };
    }

    const regex = globToRegExp(pattern);
    const matches = availableModels.filter(model => {
        const fullId = `${model.provider}/${model.id}`;
        return regex.test(fullId) || regex.test(model.id);
    });

    return {
        matches,
        thinkingLevel,
    };
}

export function restorePersistedSessionOptions<TModel extends ModelLike>(
    settingsManager: Pick<
        SettingsManagerLike,
        'getEnabledModels' | 'getDefaultProvider' | 'getDefaultModel'
    >,
    modelRegistry: ModelRegistryLike<TModel>,
    sessionManager: SessionManagerLike
): RestoredPersistedSessionOptions<TModel> {
    const availableModels = modelRegistry.getAvailable();
    const hasSessionMessages = sessionManager.buildSessionContext().messages.length > 0;
    const enabledModels = settingsManager.getEnabledModels();
    if (!enabledModels || enabledModels.length === 0) {
        if (hasSessionMessages) {
            return {
                scopedModels: [],
                diagnostics: [],
            };
        }

        const defaultProvider = settingsManager.getDefaultProvider();
        const defaultModelId = settingsManager.getDefaultModel();
        const defaultModel =
            defaultProvider && defaultModelId
                ? modelRegistry.find(defaultProvider, defaultModelId)
                : undefined;
        const defaultThinkingLevel = defaultModel
            ? getBkperAiDefaultThinkingLevel(defaultModel)
            : undefined;

        return {
            model: defaultThinkingLevel ? defaultModel : undefined,
            thinkingLevel: defaultThinkingLevel,
            scopedModels: [],
            diagnostics: [],
        };
    }

    const scopedModels: Array<ScopedModel<TModel>> = [];
    const diagnostics: AgentSessionRuntimeDiagnostic[] = [];

    for (const pattern of enabledModels) {
        const { matches, thinkingLevel } = resolvePatternMatches(pattern, availableModels);

        if (matches.length === 0) {
            diagnostics.push({
                type: 'warning',
                message: `No models match enabledModels pattern "${pattern}"`,
            });
            continue;
        }

        for (const model of matches) {
            if (scopedModels.some(scopedModel => isSameModel(scopedModel.model, model))) {
                continue;
            }

            scopedModels.push({
                model,
                thinkingLevel: thinkingLevel ?? getBkperAiDefaultThinkingLevel(model),
            });
        }
    }

    if (scopedModels.length === 0 || hasSessionMessages) {
        return {
            scopedModels,
            diagnostics,
        };
    }

    const defaultProvider = settingsManager.getDefaultProvider();
    const defaultModelId = settingsManager.getDefaultModel();
    const defaultModel =
        defaultProvider && defaultModelId
            ? modelRegistry.find(defaultProvider, defaultModelId)
            : undefined;

    const selectedModel =
        (defaultModel
            ? scopedModels.find(scopedModel => isSameModel(scopedModel.model, defaultModel))
            : undefined) ?? scopedModels[0];

    return {
        model: selectedModel?.model,
        thinkingLevel: selectedModel?.thinkingLevel,
        scopedModels,
        diagnostics,
    };
}

function reportDiagnostics(diagnostics: AgentSessionRuntimeDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
        const prefix =
            diagnostic.type === 'error'
                ? 'Error: '
                : diagnostic.type === 'warning'
                ? 'Warning: '
                : '';
        console.error(`${prefix}${diagnostic.message}`);
    }
}

const STARTUP_LEFT_PADDING = ' ';

const BKPER_SESSION_KEYBINDINGS = {
    'app.session.resume': 'ctrl+s',
    'app.session.tree': 'ctrl+r',
    'app.session.fork': 'ctrl+x',
} as const;

const installedBkperKeybindingsManagers = new WeakSet<BkperKeybindingsManager>();

const NO_MODELS_STARTUP_HINT =
    'No AI model provider configured. Run bkper auth login to use Bkper AI, or use ' +
    '/login to connect another LLM provider.';

export const BKPER_AI_PROVIDER_ID = 'bkper';

const BKPER_AI_PROVIDER_CONFIG: ProviderConfig = {
    name: 'Bkper AI',
    baseUrl: 'https://ai.bkper.app/v1',
    apiKey: '!bkper auth token',
    authHeader: true,
    api: 'openai-completions',
    models: [
        {
            id: 'openai/gpt-5.6-luna',
            name: 'GPT-5.6 Luna',
            reasoning: true,
            thinkingLevelMap: {
                minimal: null,
                low: null,
                medium: 'medium',
                high: 'high',
                xhigh: null,
                max: null,
            },
            input: ['text', 'image'],
            contextWindow: 200_000,
            maxTokens: 128_000,
            cost: {input: 1, output: 6, cacheRead: 0.1, cacheWrite: 1.25},
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                supportsUsageInStreaming: true,
                maxTokensField: 'max_tokens',
                sendSessionAffinityHeaders: true,
            },
        },
        {
            id: 'openai/gpt-5.6-terra',
            name: 'GPT-5.6 Terra',
            reasoning: true,
            thinkingLevelMap: {
                minimal: null,
                low: null,
                medium: 'medium',
                high: 'high',
                xhigh: null,
                max: null,
            },
            input: ['text', 'image'],
            contextWindow: 200_000,
            maxTokens: 128_000,
            cost: {input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125},
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                supportsUsageInStreaming: true,
                maxTokensField: 'max_tokens',
                sendSessionAffinityHeaders: true,
            },
        },
        {
            id: 'openai/gpt-5.6-sol',
            name: 'GPT-5.6 Sol',
            reasoning: true,
            thinkingLevelMap: {
                minimal: null,
                low: null,
                medium: 'medium',
                high: 'high',
                xhigh: null,
                max: null,
            },
            input: ['text', 'image'],
            contextWindow: 200_000,
            maxTokens: 128_000,
            cost: {input: 5, output: 30, cacheRead: 0.5, cacheWrite: 6.25},
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                supportsUsageInStreaming: true,
                maxTokensField: 'max_tokens',
                sendSessionAffinityHeaders: true,
            },
        },
        {
            id: 'xai/grok-4.5',
            name: 'Grok 4.5',
            reasoning: true,
            thinkingLevelMap: {
                minimal: null,
                low: null,
                medium: 'medium',
                high: 'high',
                xhigh: null,
                max: null,
            },
            input: ['text', 'image'],
            contextWindow: 200_000,
            maxTokens: 500_000,
            cost: {input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0},
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                supportsUsageInStreaming: true,
                maxTokensField: 'max_tokens',
                sendSessionAffinityHeaders: true,
            },
        },
    ],
};

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

function isShortcutClaimedByUserBinding(
    userBindings: KeybindingsConfigLike,
    targetKeybinding: string,
    shortcut: string
): boolean {
    return Object.entries(userBindings).some(
        ([keybinding, configuredBinding]) =>
            keybinding !== targetKeybinding &&
            keybindingConfigIncludesShortcut(configuredBinding, shortcut)
    );
}

export function applyBkperSessionKeybindings(
    keybindings: Pick<BkperKeybindingsManager, 'getUserBindings' | 'setUserBindings'>
): void {
    const userBindings = keybindings.getUserBindings();
    const nextBindings: KeybindingsConfigLike = {...userBindings};
    let changed = false;

    for (const [keybinding, shortcut] of Object.entries(BKPER_SESSION_KEYBINDINGS)) {
        if (
            nextBindings[keybinding] !== undefined ||
            isShortcutClaimedByUserBinding(userBindings, keybinding, shortcut)
        ) {
            continue;
        }

        nextBindings[keybinding] = shortcut;
        changed = true;
    }

    if (changed) {
        keybindings.setUserBindings(nextBindings);
    }
}

export function installBkperSessionKeybindings(keybindings: BkperKeybindingsManager): void {
    if (!installedBkperKeybindingsManagers.has(keybindings)) {
        const reload = keybindings.reload.bind(keybindings);
        keybindings.reload = () => {
            reload();
            applyBkperSessionKeybindings(keybindings);
        };
        installedBkperKeybindingsManagers.add(keybindings);
    }

    applyBkperSessionKeybindings(keybindings);
}

function wrapStartupHeaderLine(line: string, width: number): string[] {
    const normalizedWidth = Math.max(1, width);
    const trimmedLine = line.trim();

    if (!trimmedLine) {
        return [''];
    }

    const wrappedLines: string[] = [];
    let currentLine = '';

    const pushWord = (word: string): void => {
        if (!currentLine) {
            currentLine = word;
            return;
        }

        const candidate = `${currentLine} ${word}`;
        if (candidate.length <= normalizedWidth) {
            currentLine = candidate;
            return;
        }

        wrappedLines.push(currentLine);
        currentLine = word;
    };

    for (const word of trimmedLine.split(/\s+/)) {
        if (word.length <= normalizedWidth) {
            pushWord(word);
            continue;
        }

        if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = '';
        }

        for (let start = 0; start < word.length; start += normalizedWidth) {
            wrappedLines.push(word.slice(start, start + normalizedWidth));
        }
    }

    if (currentLine) {
        wrappedLines.push(currentLine);
    }

    return wrappedLines;
}

const BKPER_BANNER = [
    '██████╗ ██╗  ██╗██████╗ ███████╗██████╗ ',
    '██╔══██╗██║ ██╔╝██╔══██╗██╔════╝██╔══██╗',
    '██████╔╝█████╔╝ ██████╔╝█████╗  ██████╔╝',
    '██╔══██╗██╔═██╗ ██╔═══╝ ██╔══╝  ██╔══██╗',
    '██████╔╝██║  ██╗██║     ███████╗██║  ██║',
    '╚═════╝ ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝',
];

function formatStartupHint(theme: Theme, key: string, description: string): string {
    return theme.fg('dim', key) + theme.fg('muted', ` ${description}`);
}

function formatStartupCommandShortcut(
    command: string,
    keybinding: keyof typeof BKPER_SESSION_KEYBINDINGS
): string {
    const shortcut = keyText(keybinding);
    return shortcut ? `${command} (${shortcut})` : command;
}

function buildStartupHeaderLines(
    theme: Theme,
    modelRegistry: Pick<ModelRegistryLike, 'getAvailable'>,
    width: number
): string[] {
    const lines = [
        ...BKPER_BANNER.map(line => theme.bold(theme.fg('accent', line))),
        theme.fg('muted', `powered by `) + theme.fg('dim', `pi v${PI_VERSION}`),
        '',
        formatStartupHint(theme, keyText('app.interrupt'), 'to interrupt'),
        formatStartupHint(theme, keyText('app.clear'), 'to clear'),
        formatStartupHint(theme, `${keyText('app.clear')} twice`, 'to exit'),
        formatStartupHint(theme, '/', 'for commands'),
        formatStartupHint(theme, '/new', 'to start new session'),
        formatStartupHint(
            theme,
            formatStartupCommandShortcut('/resume', 'app.session.resume'),
            'to resume a session'
        ),
        formatStartupHint(theme, '/clone', 'to duplicate session'),
        formatStartupHint(
            theme,
            formatStartupCommandShortcut('/fork', 'app.session.fork'),
            'to branch from a message'
        ),
        formatStartupHint(
            theme,
            formatStartupCommandShortcut('/tree', 'app.session.tree'),
            'for session tree'
        ),
        formatStartupHint(theme, '!', 'to run bash'),
    ];

    if (modelRegistry.getAvailable().length === 0) {
        lines.push(
            '',
            ...wrapStartupHeaderLine(NO_MODELS_STARTUP_HINT, width).map(line =>
                theme.fg('warning', line)
            )
        );
    }

    return lines.map(line => (line.length > 0 ? STARTUP_LEFT_PADDING + line : line));
}

function createStartupHeaderFactory(
    modelRegistry: Pick<ModelRegistryLike, 'getAvailable'>
): StartupHeaderFactory {
    return (_tui, theme) => ({
        render: (width: number) => buildStartupHeaderLines(theme, modelRegistry, width),
        invalidate: () => {},
    });
}

export function isBkperAgentVerboseDiagnosticsEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return env.BKPER_AGENT_DEBUG === '1' || env.PI_VERBOSE === '1';
}

function isBkperAgentInlineExtensionPath(path: string): boolean {
    return INLINE_EXTENSION_PATH_PATTERN.test(path);
}

function normalizeBkperAgentExtension(extension: Extension): Extension {
    if (!isBkperAgentInlineExtensionPath(extension.path)) {
        return extension;
    }

    return {
        ...extension,
        path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
        resolvedPath: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
        sourceInfo: {
            ...extension.sourceInfo,
            path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
            source: 'inline',
        },
    };
}

export function normalizeBkperAgentExtensionErrors(
    errors: ExtensionLoadError[],
    options: {verbose: boolean}
): ExtensionLoadError[] {
    return errors.map(error => {
        if (!isBkperAgentInlineExtensionPath(error.path)) {
            return error;
        }

        return {
            path: BKPER_AGENT_BUILTINS_EXTENSION_PATH,
            error: options.verbose
                ? `${BUILT_IN_BKPER_AGENT_FEATURE_ERROR}\nDetails: ${error.path} ${error.error}`
                : BUILT_IN_BKPER_AGENT_FEATURE_ERROR,
        };
    });
}

export function normalizeBkperAgentExtensions(
    base: LoadExtensionsResult,
    options: {verbose: boolean}
): LoadExtensionsResult {
    return {
        ...base,
        extensions: base.extensions.map(normalizeBkperAgentExtension),
        errors: normalizeBkperAgentExtensionErrors(base.errors, options),
    };
}

export function registerBkperAgentStartupExtension(
    pi: StartupExtensionAPI,
    startupMaintenance: typeof runStartupMaintenance = runStartupMaintenance,
    settingsManager?: Pick<SettingsManagerLike, 'getQuietStartup'>
): void {
    let startupMaintenanceTriggered = false;

    pi.on('session_start', async (_event, ctx) => {
        if (!settingsManager?.getQuietStartup()) {
            ctx.ui.setHeader(createStartupHeaderFactory(ctx.modelRegistry));
        }

        if (startupMaintenanceTriggered) {
            return;
        }
        startupMaintenanceTriggered = true;

        void startupMaintenance({
            notify: (message, type) => ctx.ui.notify(message, type),
        });
    });
}

export function registerBkperAiProvider(pi: ProviderRegistrationAPI): void {
    pi.registerProvider(BKPER_AI_PROVIDER_ID, BKPER_AI_PROVIDER_CONFIG);
}

export function registerBkperAgentBuiltins(
    pi: ExtensionAPI,
    startupMaintenance: typeof runStartupMaintenance = runStartupMaintenance,
    settingsManager?: Pick<SettingsManagerLike, 'getQuietStartup'>
): void {
    registerBkperCoreConceptsPreloadExtension(pi);
    registerBkperAgentStartupExtension(pi, startupMaintenance, settingsManager);
    registerBkperAiProvider(pi);
}

export interface SessionOptions {
    continueSession?: boolean;
    noSession?: boolean;
}

export function createAgentModeDependencies(
    sessionOptions: SessionOptions = {}
): AgentModeDependencies {
    return {
        createRuntime: async () => {
            const cwd = process.cwd();
            const agentDir = getAgentDir();
            const startupSettingsManager = SettingsManager.create(cwd, agentDir);
            const startupDiagnostics = collectSettingsDiagnostics(
                startupSettingsManager,
                'startup session lookup'
            );

            const createRuntime: CreateAgentSessionRuntimeFactory = async ({
                cwd,
                agentDir,
                sessionManager,
                sessionStartEvent,
            }) => {
                const settingsManager = SettingsManager.create(cwd, agentDir);
                const services = await createAgentSessionServices({
                    cwd,
                    agentDir,
                    settingsManager,
                    resourceLoaderOptions: {
                        systemPromptOverride: () => getBkperAgentSystemPrompt(),
                        extensionFactories: [
                            (pi: ExtensionAPI) => {
                                registerBkperAgentBuiltins(
                                    pi,
                                    runStartupMaintenance,
                                    settingsManager
                                );
                            },
                        ],
                        extensionsOverride: base =>
                            normalizeBkperAgentExtensions(base, {
                                verbose: isBkperAgentVerboseDiagnosticsEnabled(),
                            }),
                    },
                });
                const restoredSessionOptions = restorePersistedSessionOptions(
                    settingsManager,
                    services.modelRegistry,
                    sessionManager
                );

                return {
                    ...(await createAgentSessionFromServices({
                        services,
                        sessionManager,
                        sessionStartEvent,
                        model: restoredSessionOptions.model,
                        thinkingLevel: restoredSessionOptions.thinkingLevel,
                        scopedModels: restoredSessionOptions.scopedModels,
                    })),
                    services,
                    diagnostics: [
                        ...services.diagnostics,
                        ...collectSettingsDiagnostics(settingsManager, 'runtime creation'),
                        ...restoredSessionOptions.diagnostics,
                    ],
                };
            };

            const sessionDir = startupSettingsManager.getSessionDir();
            let sessionManager: SessionManager;

            if (sessionOptions.continueSession) {
                sessionManager = SessionManager.continueRecent(cwd, sessionDir);
            } else if (sessionOptions.noSession) {
                sessionManager = SessionManager.inMemory();
            } else {
                sessionManager = createStartupSessionManager(
                    cwd,
                    startupSettingsManager,
                    (sessionCwd, sessionDir) => SessionManager.create(sessionCwd, sessionDir)
                );
            }

            const runtime = await createAgentSessionRuntime(createRuntime, {
                cwd,
                agentDir,
                sessionManager,
            });

            return {
                runtime,
                modelFallbackMessage: runtime.modelFallbackMessage,
                diagnostics: [...startupDiagnostics, ...runtime.diagnostics],
            };
        },
        createInteractiveMode: (runtime, modelFallbackMessage) =>
            new BkperInteractiveMode(runtime, {
                modelFallbackMessage,
            }),
    };
}

export async function runAgentMode(
    dependencies: AgentModeDependencies = createAgentModeDependencies()
): Promise<void> {
    process.env.PI_SKIP_VERSION_CHECK ??= '1';

    const { runtime, modelFallbackMessage, diagnostics = [] } = await dependencies.createRuntime();
    reportDiagnostics(diagnostics);

    const mode = dependencies.createInteractiveMode(runtime, modelFallbackMessage);

    await mode.run();
}
