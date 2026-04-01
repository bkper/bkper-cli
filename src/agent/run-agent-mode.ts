import {
    createAgentSession,
    DefaultResourceLoader,
    InteractiveMode,
    type CreateAgentSessionOptions,
    type ExtensionAPI,
} from '@mariozechner/pi-coding-agent';
import { runStartupMaintenance } from './startup-maintenance.js';
import { getBkperAgentSystemPrompt } from './system-prompt.js';

type ReloadableResourceLoader = {
    reload(): Promise<void>;
};

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
    createResourceLoader: () => ReloadableResourceLoader;
    createSession: (options: {
        resourceLoader: ReloadableResourceLoader;
    }) => Promise<{
        session: unknown;
        modelFallbackMessage?: string;
    }>;
    createInteractiveMode: (
        session: unknown,
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
        createResourceLoader: () =>
            new DefaultResourceLoader({
                systemPromptOverride: () => getBkperAgentSystemPrompt(),
                extensionFactories: [
                    (pi: ExtensionAPI) => {
                        registerBkperAgentStartupExtension(pi);
                    },
                ],
            }),
        createSession: async ({ resourceLoader }) =>
            createAgentSession({
                resourceLoader:
                    resourceLoader as NonNullable<CreateAgentSessionOptions['resourceLoader']>,
            }),
        createInteractiveMode: (session, modelFallbackMessage) =>
            new InteractiveMode(session as ConstructorParameters<typeof InteractiveMode>[0], {
                modelFallbackMessage,
            }),
    };
}

export async function runAgentMode(
    dependencies: AgentModeDependencies = createDefaultDependencies()
): Promise<void> {
    process.env.PI_SKIP_VERSION_CHECK ??= '1';

    const resourceLoader = dependencies.createResourceLoader();
    await resourceLoader.reload();

    const { session, modelFallbackMessage } = await dependencies.createSession({ resourceLoader });
    const mode = dependencies.createInteractiveMode(session, modelFallbackMessage);

    await mode.run();
}
