import {
    createAgentSessionFromServices,
    createAgentSessionRuntime,
    createAgentSessionServices,
    getAgentDir,
    InteractiveMode,
    SessionManager,
    type CreateAgentSessionRuntimeFactory,
    type ExtensionAPI,
} from '@mariozechner/pi-coding-agent';
import { runStartupMaintenance } from './startup-maintenance.js';
import { getBkperAgentSystemPrompt } from './system-prompt.js';

export type InteractiveRuntimeHost = ConstructorParameters<typeof InteractiveMode>[0];

type NotificationType = 'info' | 'warning' | 'error';

type SessionStartContext = {
    ui: {
        notify: (message: string, type?: NotificationType) => void;
    };
};

type SessionStartHandler = (event: unknown, context: SessionStartContext) => Promise<void>;

type StartupExtensionAPI = {
    on: (event: 'session_start', handler: SessionStartHandler) => void;
};

export interface AgentModeDependencies {
    createRuntime: () => Promise<{
        runtime: InteractiveRuntimeHost;
        modelFallbackMessage?: string;
    }>;
    createInteractiveMode: (
        runtime: InteractiveRuntimeHost,
        modelFallbackMessage?: string
    ) => {
        run(): Promise<void>;
    };
}

export function registerBkperAgentStartupExtension(
    pi: StartupExtensionAPI,
    startupMaintenance: typeof runStartupMaintenance = runStartupMaintenance
): void {
    let startupMaintenanceTriggered = false;

    pi.on('session_start', async (_event, ctx) => {
        ctx.ui.notify('Bkper Agent ready.', 'info');

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
            const createRuntime: CreateAgentSessionRuntimeFactory = async ({
                cwd,
                agentDir,
                sessionManager,
                sessionStartEvent,
            }) => {
                const services = await createAgentSessionServices({
                    cwd,
                    agentDir,
                    resourceLoaderOptions: {
                        systemPromptOverride: () => getBkperAgentSystemPrompt(),
                        extensionFactories: [
                            (pi: ExtensionAPI) => {
                                registerBkperAgentStartupExtension(pi);
                            },
                        ],
                    },
                });

                return {
                    ...(await createAgentSessionFromServices({
                        services,
                        sessionManager,
                        sessionStartEvent,
                    })),
                    services,
                    diagnostics: services.diagnostics,
                };
            };

            const runtime = await createAgentSessionRuntime(createRuntime, {
                cwd: process.cwd(),
                agentDir: getAgentDir(),
                sessionManager: SessionManager.create(process.cwd()),
            });

            return {
                runtime,
                modelFallbackMessage: runtime.modelFallbackMessage,
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

    const { runtime, modelFallbackMessage } = await dependencies.createRuntime();
    const mode = dependencies.createInteractiveMode(runtime, modelFallbackMessage);

    await mode.run();
}
