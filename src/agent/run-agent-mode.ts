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
    type ExtensionAPI,
    type Theme,
} from '@mariozechner/pi-coding-agent';
import { VERSION as PI_VERSION } from '@mariozechner/pi-coding-agent';
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
    return settingsManager.drainErrors().map(({scope, error}) => ({
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

function resolvePatternMatches<TModel extends ModelLike>(
    rawPattern: string,
    availableModels: TModel[]
): {
    matches: TModel[];
    thinkingLevel?: ScopedThinkingLevel;
} {
    const exactMatches = findExactModelMatch(rawPattern, availableModels);
    if (exactMatches.length > 0) {
        return {matches: exactMatches};
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
    const enabledModels = settingsManager.getEnabledModels();
    if (!enabledModels || enabledModels.length === 0) {
        return {
            scopedModels: [],
            diagnostics: [],
        };
    }

    const availableModels = modelRegistry.getAvailable();
    const scopedModels: Array<ScopedModel<TModel>> = [];
    const diagnostics: AgentSessionRuntimeDiagnostic[] = [];

    for (const pattern of enabledModels) {
        const {matches, thinkingLevel} = resolvePatternMatches(pattern, availableModels);

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
                thinkingLevel,
            });
        }
    }

    if (scopedModels.length === 0 || sessionManager.buildSessionContext().messages.length > 0) {
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

const NO_MODELS_STARTUP_HINT = 'No model provider configured. Use /login or add an API key.';

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
        formatStartupHint(theme, '/tree', 'for session tree'),
        formatStartupHint(theme, '/fork', 'to branch from a message'),
        formatStartupHint(theme, '/clone', 'to duplicate session'),
        formatStartupHint(theme, '/', 'for commands'),
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

    return lines;
}

function createStartupHeaderFactory(
    modelRegistry: Pick<ModelRegistryLike, 'getAvailable'>
): StartupHeaderFactory {
    return (_tui, theme) => ({
        render: (width: number) => buildStartupHeaderLines(theme, modelRegistry, width),
        invalidate: () => {},
    });
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

function createDefaultDependencies(): AgentModeDependencies {
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
                                registerBkperAgentStartupExtension(pi, runStartupMaintenance, settingsManager);
                            },
                        ],
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

            const runtime = await createAgentSessionRuntime(createRuntime, {
                cwd,
                agentDir,
                sessionManager: createStartupSessionManager(
                    cwd,
                    startupSettingsManager,
                    (sessionCwd, sessionDir) => SessionManager.create(sessionCwd, sessionDir)
                ),
            });

            return {
                runtime,
                modelFallbackMessage: runtime.modelFallbackMessage,
                diagnostics: [...startupDiagnostics, ...runtime.diagnostics],
            };
        },
        createInteractiveMode: (runtime, modelFallbackMessage) =>
            new InteractiveMode(runtime, {
                modelFallbackMessage,
            }),
    };
}

export async function runAgentMode(
    dependencies: AgentModeDependencies = createDefaultDependencies()
): Promise<void> {
    process.env.PI_SKIP_VERSION_CHECK ??= '1';

    const {runtime, modelFallbackMessage, diagnostics = []} = await dependencies.createRuntime();
    reportDiagnostics(diagnostics);

    const mode = dependencies.createInteractiveMode(runtime, modelFallbackMessage);

    await mode.run();
}
