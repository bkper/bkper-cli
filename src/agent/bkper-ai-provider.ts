import type { ExtensionAPI, ProviderConfig } from '@earendil-works/pi-coding-agent';

export const BKPER_AI_PROVIDER_ID = 'bkper';
export const BKPER_AI_STARTUP_DEFAULT_MODEL_ID = 'xai/grok-4.5';
export const BKPER_AI_PRODUCTION_BASE_URL = 'https://ai.bkper.app/v1';

const BKPER_AI_BASE_URL_ENV_VAR = 'BKPER_AI_BASE_URL';
const BKPER_AI_DEVELOPMENT_ORIGIN = 'https://ai-dev.bkper.app';

export const BKPER_AI_PROVIDER_CONFIG: ProviderConfig = {
    name: 'Bkper AI',
    baseUrl: BKPER_AI_PRODUCTION_BASE_URL,
    apiKey: '!bkper auth token',
    authHeader: true,
    headers: {
        'bkper-agent-id': 'bkper-cli',
        'User-Agent': 'bkper-cli',
    },
    api: 'openai-responses',
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
                sessionAffinityFormat: 'openai',
                supportsLongCacheRetention: false,
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
                sessionAffinityFormat: 'openai',
                supportsLongCacheRetention: false,
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
                sessionAffinityFormat: 'openai',
                supportsLongCacheRetention: false,
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
                sessionAffinityFormat: 'openai',
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
                sessionAffinityFormat: 'openai',
                supportsLongCacheRetention: false,
            },
        },
    ],
};

function invalidBkperAiBaseUrlError(): Error {
    return new Error(
        `${BKPER_AI_BASE_URL_ENV_VAR} must be an HTTPS URL on ai-dev.bkper.app ` +
            'without credentials, a custom port, query parameters, or a fragment.'
    );
}

export function getBkperAiBaseUrlOverride(
    env: Record<string, string | undefined> = process.env
): string | undefined {
    const configuredBaseUrl = env[BKPER_AI_BASE_URL_ENV_VAR];
    if (configuredBaseUrl === undefined) {
        return undefined;
    }

    let url: URL;
    try {
        url = new URL(configuredBaseUrl);
    } catch {
        throw invalidBkperAiBaseUrlError();
    }

    if (
        configuredBaseUrl.trim() !== configuredBaseUrl ||
        url.origin !== BKPER_AI_DEVELOPMENT_ORIGIN ||
        url.username !== '' ||
        url.password !== '' ||
        url.search !== '' ||
        url.hash !== ''
    ) {
        throw invalidBkperAiBaseUrlError();
    }

    const path = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${path}`;
}

export function getBkperAiProviderConfig(
    env: Record<string, string | undefined> = process.env
): ProviderConfig {
    const baseUrlOverride = getBkperAiBaseUrlOverride(env);
    if (!baseUrlOverride) {
        return BKPER_AI_PROVIDER_CONFIG;
    }

    return {
        ...BKPER_AI_PROVIDER_CONFIG,
        baseUrl: baseUrlOverride,
    };
}

export function registerBkperAiProvider(
    pi: Pick<ExtensionAPI, 'registerProvider'>,
    env: Record<string, string | undefined> = process.env
): void {
    pi.registerProvider(BKPER_AI_PROVIDER_ID, getBkperAiProviderConfig(env));
}
