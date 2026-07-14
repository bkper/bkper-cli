import type { ExtensionAPI, ProviderConfig } from '@earendil-works/pi-coding-agent';

export const BKPER_AI_PROVIDER_ID = 'bkper';
export const BKPER_AI_STARTUP_DEFAULT_MODEL_ID = 'xai/grok-4.5';

export const BKPER_AI_PROVIDER_CONFIG: ProviderConfig = {
    name: 'Bkper AI',
    baseUrl: 'https://ai.bkper.app/v1',
    apiKey: '!bkper auth token',
    authHeader: true,
    headers: {
        'bkper-agent-id': 'bkper-cli',
    },
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
            maxTokens: 32_000,
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
            maxTokens: 32_000,
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
            maxTokens: 32_000,
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
            id: 'anthropic/claude-fable-5',
            name: 'Claude Fable 5',
            reasoning: true,
            thinkingLevelMap: {
                off: 'off',
                minimal: null,
                low: 'low',
                medium: 'medium',
                high: null,
                xhigh: null,
                max: null,
            },
            input: ['text', 'image'],
            contextWindow: 200_000,
            maxTokens: 32_000,
            cost: {input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5},
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: true,
                supportsUsageInStreaming: true,
                maxTokensField: 'max_tokens',
                sendSessionAffinityHeaders: true,
                supportsLongCacheRetention: false,
            },
        },
        {
            id: BKPER_AI_STARTUP_DEFAULT_MODEL_ID,
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
            maxTokens: 32_000,
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

export function registerBkperAiProvider(
    pi: Pick<ExtensionAPI, 'registerProvider'>
): void {
    pi.registerProvider(BKPER_AI_PROVIDER_ID, BKPER_AI_PROVIDER_CONFIG);
}
