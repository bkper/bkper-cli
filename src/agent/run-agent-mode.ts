import {
    createAgentSession,
    DefaultResourceLoader,
    InteractiveMode,
    type CreateAgentSessionOptions,
    type ExtensionAPI,
} from '@mariozechner/pi-coding-agent';
import { BKPER_AGENT_SYSTEM_PROMPT } from './system-prompt.js';

type ReloadableResourceLoader = {
    reload(): Promise<void>;
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

function createDefaultDependencies(): AgentModeDependencies {
    return {
        createResourceLoader: () =>
            new DefaultResourceLoader({
                systemPromptOverride: () => BKPER_AGENT_SYSTEM_PROMPT,
                appendSystemPromptOverride: () => [],
                extensionFactories: [
                    (pi: ExtensionAPI) => {
                        pi.on('session_start', async (_event, ctx) => {
                            ctx.ui.notify('Bkper Agent ready.', 'info');
                        });
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
    const resourceLoader = dependencies.createResourceLoader();
    await resourceLoader.reload();

    const { session, modelFallbackMessage } = await dependencies.createSession({ resourceLoader });
    const mode = dependencies.createInteractiveMode(session, modelFallbackMessage);

    await mode.run();
}
