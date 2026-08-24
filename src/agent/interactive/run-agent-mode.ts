import {join} from 'node:path';
import {
    createAgentSessionFromServices,
    createAgentSessionRuntime,
    createAgentSessionServices,
    getAgentDir,
    ModelRuntime,
    SessionManager,
    SettingsManager,
    type AgentSessionRuntimeDiagnostic,
    type CreateAgentSessionRuntimeFactory,
    type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import {
    isBkperAgentVerboseDiagnosticsEnabled,
    normalizeBkperAgentExtensions,
    registerBkperAgentBuiltins,
} from '../extensions/builtins.js';
import {getBkperAiBaseUrlOverride} from '../extensions/bkper-ai-provider.js';
import {runStartupMaintenance} from '../startup-maintenance.js';
import {getBkperAgentSystemPrompt} from '../system-prompt.js';
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
} from './settings.js';

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

export interface SessionOptions {
    continueSession?: boolean;
    noSession?: boolean;
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
                const selectedTools = settingsManager.getDefaultTools() ?? [];
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
                const services = await createAgentSessionServices({
                    cwd,
                    agentDir,
                    settingsManager,
                    modelRuntime,
                    resourceLoaderOptions: {
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
                                    dispatchHandoffCommand
                                );
                            },
                        ],
                        extensionsOverride: base =>
                            normalizeBkperAgentExtensions(base, {
                                verbose: isBkperAgentVerboseDiagnosticsEnabled(),
                            }),
                    },
                });
                settingsManager.applyOverrides({defaultTools: selectedTools});
                applyBkperAgentSettingsDefaults(settingsManager);
                const restoredSessionOptions = restorePersistedSessionOptions(
                    settingsManager,
                    {
                        getAvailable: () => [...services.modelRuntime.getAvailableSnapshot()],
                        find: (provider, modelId) =>
                            services.modelRuntime.getModel(provider, modelId),
                    },
                    sessionManager
                );

                const sessionResult = await createAgentSessionFromServices({
                    services,
                    sessionManager,
                    sessionStartEvent,
                    model: restoredSessionOptions.model,
                    thinkingLevel: restoredSessionOptions.thinkingLevel,
                    scopedModels: restoredSessionOptions.scopedModels,
                });
                promptHandoffCommand = command => sessionResult.session.prompt(command);

                return {
                    ...sessionResult,
                    services,
                    diagnostics: [
                        ...services.diagnostics,
                        ...toolDiagnostics,
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

    const {runtime, modelFallbackMessage, diagnostics = []} =
        await dependencies.createRuntime();
    reportDiagnostics(diagnostics);

    const mode = dependencies.createInteractiveMode(runtime, modelFallbackMessage);

    await mode.run();
}
