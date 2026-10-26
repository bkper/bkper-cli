import {join} from 'node:path';
import {
    createAgentSessionFromServices,
    createAgentSessionRuntime,
    createAgentSessionServices,
    getAgentDir,
    ModelRuntime,
    resolveCliModel,
    SessionManager,
    SettingsManager,
    type AgentSessionRuntimeDiagnostic,
    type Args,
    type CreateAgentSessionRuntimeFactory,
    type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import {
    isBkperAgentVerboseDiagnosticsEnabled,
    normalizeBkperAgentExtensions,
    registerBkperAgentBuiltins,
} from '../extensions/builtins.js';
import {getBkperAiBaseUrlOverride} from '../extensions/bkper-ai-provider.js';
import {editHandoffGoal} from '../extensions/handoff-goal-editor.js';
import {AgentStartupError} from '../startup-error.js';
import {runStartupMaintenance} from '../startup-maintenance.js';
import {getBkperAgentSystemPrompt} from '../system-prompt.js';
import {buildInitialPrompt, type InitialPrompt} from './initial-prompt.js';
import {FilePromptHistory, getPromptHistoryPath} from './prompt-history-store.js';
import {
    BkperInteractiveMode,
    type InteractiveRuntimeHost,
} from './interactive-mode.js';
import {restorePersistedSessionOptions} from './session-restore.js';
import {
    applyBkperAgentSettingsDefaults,
    applyBkperAgentToolSelection,
    collectSettingsDiagnostics,
    createStartupSessionManager,
    overrideDefaultTools,
    selectCliTools,
} from './settings.js';
import {getBkperThemesDir, resolveBkperInitialThemeSetting} from './themes.js';

export interface AgentModeDependencies {
    createRuntime: () => Promise<{
        runtime: InteractiveRuntimeHost;
        modelFallbackMessage?: string;
        diagnostics?: AgentSessionRuntimeDiagnostic[];
        initialPrompt?: InitialPrompt;
    }>;
    createInteractiveMode: (
        runtime: InteractiveRuntimeHost,
        modelFallbackMessage?: string,
        initialPrompt?: InitialPrompt
    ) => {
        run(): Promise<void>;
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

/** The Pi CLI options Bkper Agent supports in its own interactive mode. */
export interface SessionOptions {
    continueSession?: boolean;
    noSession?: boolean;
    /** Path of the session file to open. */
    sessionFile?: string;
    provider?: string;
    model?: string;
    thinking?: Args['thinking'];
    tools?: string[];
    extensionPaths?: string[];
    noExtensions?: boolean;
    noSkills?: boolean;
    noPromptTemplates?: boolean;
    noContextFiles?: boolean;
    messages?: string[];
    fileArgs?: string[];
}

type CliModelSelection = {
    model?: ReturnType<typeof resolveCliModel>['model'];
    thinkingLevel?: Args['thinking'];
    diagnostics: AgentSessionRuntimeDiagnostic[];
};

/** Resolves `--provider`, `--model`, and `--thinking` as Pi does; invalid selections stop startup. */
function resolveCliModelSelection(
    sessionOptions: SessionOptions,
    modelRuntime: ModelRuntime
): CliModelSelection {
    if (sessionOptions.provider && !sessionOptions.model) {
        throw new AgentStartupError(
            `--provider requires --model (for example: --provider ${sessionOptions.provider} --model <pattern>)`
        );
    }
    if (!sessionOptions.model) {
        return {thinkingLevel: sessionOptions.thinking, diagnostics: []};
    }

    const resolved = resolveCliModel({
        cliProvider: sessionOptions.provider,
        cliModel: sessionOptions.model,
        cliThinking: sessionOptions.thinking,
        modelRuntime,
    });
    if (resolved.error || !resolved.model) {
        throw new AgentStartupError(resolved.error ?? `Model "${sessionOptions.model}" not found`);
    }
    return {
        model: resolved.model,
        thinkingLevel: sessionOptions.thinking ?? resolved.thinkingLevel,
        diagnostics: resolved.warning ? [{type: 'warning', message: resolved.warning}] : [],
    };
}

export function createAgentModeDependencies(
    sessionOptions: SessionOptions = {}
): AgentModeDependencies {
    return {
        createRuntime: async () => {
            getBkperAiBaseUrlOverride();

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
                const toolDiagnostics = applyBkperAgentToolSelection(settingsManager);
                const defaultTools = settingsManager.getDefaultTools() ?? [];
                const selectedTools = sessionOptions.tools
                    ? selectCliTools(defaultTools, sessionOptions.tools)
                    : defaultTools;
                const modelRuntime = await ModelRuntime.create({
                    authPath: join(agentDir, 'auth.json'),
                    modelsPath: join(agentDir, 'models.json'),
                });
                let promptHandoffCommand: ((command: string) => Promise<void>) | undefined;
                const dispatchHandoffCommand = async (command: string): Promise<void> => {
                    if (!promptHandoffCommand) {
                        throw new Error('Handoff command dispatch is not ready.');
                    }
                    await promptHandoffCommand(command);
                };
                const promptHistory = new FilePromptHistory(getPromptHistoryPath(agentDir));
                const services = await createAgentSessionServices({
                    cwd,
                    agentDir,
                    settingsManager,
                    modelRuntime,
                    resourceLoaderOptions: {
                        additionalThemePaths: [getBkperThemesDir()],
                        additionalExtensionPaths: sessionOptions.extensionPaths,
                        // Bkper Agent built-ins are extension factories, which these flags keep.
                        noExtensions: sessionOptions.noExtensions,
                        noSkills: sessionOptions.noSkills,
                        noPromptTemplates: sessionOptions.noPromptTemplates,
                        noContextFiles: sessionOptions.noContextFiles,
                        systemPromptOverride: () =>
                            getBkperAgentSystemPrompt(selectedTools),
                        extensionFactories: [
                            (pi: ExtensionAPI) => {
                                registerBkperAgentBuiltins(
                                    pi,
                                    runStartupMaintenance,
                                    settingsManager,
                                    process.env,
                                    modelRuntime,
                                    dispatchHandoffCommand,
                                    (prefill, context) =>
                                        editHandoffGoal(prefill, context, {
                                            history: promptHistory,
                                            templates: services.resourceLoader.getPrompts().prompts,
                                            externalEditorCommand:
                                                settingsManager.getExternalEditorCommand(),
                                        })
                                );
                            },
                        ],
                        extensionsOverride: base =>
                            normalizeBkperAgentExtensions(base, {
                                verbose: isBkperAgentVerboseDiagnosticsEnabled(),
                            }),
                    },
                });
                applyBkperAgentSettingsDefaults(settingsManager);
                overrideDefaultTools(settingsManager, defaultTools);
                const restoredSessionOptions = restorePersistedSessionOptions(
                    settingsManager,
                    {
                        getAvailable: () => [...services.modelRuntime.getAvailableSnapshot()],
                        find: (provider, modelId) =>
                            services.modelRuntime.getModel(provider, modelId),
                    },
                    sessionManager
                );
                const cliModelSelection = resolveCliModelSelection(
                    sessionOptions,
                    services.modelRuntime
                );

                const sessionResult = await createAgentSessionFromServices({
                    services,
                    sessionManager,
                    sessionStartEvent,
                    model: cliModelSelection.model ?? restoredSessionOptions.model,
                    thinkingLevel:
                        cliModelSelection.thinkingLevel ??
                        (cliModelSelection.model
                            ? undefined
                            : restoredSessionOptions.thinkingLevel),
                    scopedModels: restoredSessionOptions.scopedModels,
                    tools: sessionOptions.tools,
                });
                if (sessionResult.session.model && cliModelSelection.thinkingLevel) {
                    // As Pi does, record the CLI thinking level, clamped to the model, in the session.
                    sessionResult.session.setThinkingLevel(sessionResult.session.thinkingLevel);
                }
                promptHandoffCommand = command => sessionResult.session.prompt(command);

                return {
                    ...sessionResult,
                    services,
                    diagnostics: [
                        ...services.diagnostics,
                        ...toolDiagnostics,
                        ...collectSettingsDiagnostics(settingsManager, 'runtime creation'),
                        ...restoredSessionOptions.diagnostics,
                        ...cliModelSelection.diagnostics,
                    ],
                };
            };

            // Read @file arguments before creating anything, so a missing file stops startup cleanly.
            const initialPrompt = await buildInitialPrompt(
                sessionOptions.messages,
                sessionOptions.fileArgs,
                cwd
            );
            const sessionDir = startupSettingsManager.getSessionDir();
            let sessionManager: SessionManager;

            if (sessionOptions.noSession) {
                sessionManager = SessionManager.inMemory();
            } else if (sessionOptions.sessionFile) {
                sessionManager = SessionManager.open(sessionOptions.sessionFile, sessionDir);
            } else if (sessionOptions.continueSession) {
                sessionManager = SessionManager.continueRecent(cwd, sessionDir);
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
                initialPrompt,
            };
        },
        createInteractiveMode: (runtime, modelFallbackMessage, initialPrompt) =>
            new BkperInteractiveMode(runtime, {
                ...initialPrompt,
                modelFallbackMessage,
                initialThemeSetting: resolveBkperInitialThemeSetting(
                    runtime.services.settingsManager
                ),
            }),
    };
}

export async function runAgentMode(
    dependencies: AgentModeDependencies = createAgentModeDependencies()
): Promise<void> {
    process.env.PI_SKIP_VERSION_CHECK ??= '1';

    const {runtime, modelFallbackMessage, diagnostics = [], initialPrompt} =
        await dependencies.createRuntime();
    reportDiagnostics(diagnostics);

    const mode = dependencies.createInteractiveMode(
        runtime,
        modelFallbackMessage,
        initialPrompt
    );

    await mode.run();
}
