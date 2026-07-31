import type {
    ExtensionAPI,
    ProviderConfig,
    ProviderModelConfig,
} from '@earendil-works/pi-coding-agent';

export const BKPER_AI_PROVIDER_ID = 'bkper';
export const BKPER_AI_PRODUCTION_BASE_URL = 'https://ai.bkper.app/v1';

const BKPER_AI_BASE_URL_ENV_VAR = 'BKPER_AI_BASE_URL';
const BKPER_AI_DEVELOPMENT_ORIGIN = 'https://ai-dev.bkper.app';
const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export type BkperAiThinkingLevel = (typeof THINKING_LEVELS)[number];

export interface BkperAiModelMetadata {
    provider: string;
    bkperDefault?: boolean;
    bkperDefaultThinkingLevel?: BkperAiThinkingLevel;
}

interface BkperAiModelConfig extends ProviderModelConfig {
    bkperDefault: boolean;
    bkperDefaultThinkingLevel?: BkperAiThinkingLevel;
}

interface BkperAiCatalogModel {
    id: string;
    display_name?: string;
    input_modalities?: string[];
    pricing: {
        inputNanoUsdPerToken: number;
        cachedInputNanoUsdPerToken: number;
        cacheWriteNanoUsdPerToken: number;
        outputNanoUsdPerToken: number;
    };
    default_thinking_level?: string;
    context_window: number;
    max_output_tokens: number;
    thinking_levels: string[];
}

interface BkperAiCatalog {
    default_model?: string;
    data: BkperAiCatalogModel[];
}

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

function isThinkingLevel(value: string | undefined): value is BkperAiThinkingLevel {
    return THINKING_LEVELS.some(level => level === value);
}

function getDefaultThinkingLevel(model: BkperAiCatalogModel): BkperAiThinkingLevel | undefined {
    if (isThinkingLevel(model.default_thinking_level)) {
        return model.default_thinking_level;
    }
    if (model.thinking_levels.includes('high')) {
        return 'high';
    }
    return model.thinking_levels.find(isThinkingLevel);
}

function getThinkingLevelMap(
    levels: string[]
): NonNullable<ProviderModelConfig['thinkingLevelMap']> {
    const supports = (level: string): string | null => (levels.includes(level) ? level : null);
    return {
        off: levels.includes('none') ? 'none' : null,
        minimal: supports('minimal'),
        low: supports('low'),
        medium: supports('medium'),
        high: supports('high'),
        xhigh: supports('xhigh'),
        max: supports('max'),
    };
}

function nanoUsdPerTokenToUsdPerMillion(value: number): number {
    return value / 1_000;
}

function toProviderModel(
    model: BkperAiCatalogModel,
    defaultModelId: string | undefined
): BkperAiModelConfig {
    const input = model.input_modalities?.filter(
        (modality): modality is 'text' | 'image' => modality === 'text' || modality === 'image'
    ) ?? ['text', 'image'];

    return {
        id: model.id,
        name: model.display_name ?? model.id,
        reasoning: model.thinking_levels.some(level => level !== 'none'),
        thinkingLevelMap: getThinkingLevelMap(model.thinking_levels),
        input,
        cost: {
            input: nanoUsdPerTokenToUsdPerMillion(model.pricing.inputNanoUsdPerToken),
            output: nanoUsdPerTokenToUsdPerMillion(model.pricing.outputNanoUsdPerToken),
            cacheRead: nanoUsdPerTokenToUsdPerMillion(
                model.pricing.cachedInputNanoUsdPerToken
            ),
            cacheWrite: nanoUsdPerTokenToUsdPerMillion(
                model.pricing.cacheWriteNanoUsdPerToken
            ),
        },
        contextWindow: model.context_window,
        maxTokens: model.max_output_tokens,
        compat: {
            supportsDeveloperRole: false,
            sessionAffinityFormat: 'openai',
            supportsLongCacheRetention: false,
        },
        bkperDefault: model.id === defaultModelId,
        bkperDefaultThinkingLevel: getDefaultThinkingLevel(model),
    };
}

async function fetchBkperAiModels(
    baseUrl: string,
    fetchFn: typeof fetch,
    signal?: AbortSignal
): Promise<BkperAiModelConfig[]> {
    const response = await fetchFn(`${baseUrl}/models`, {signal});
    if (!response.ok) {
        throw new Error(`Bkper AI model request failed (${response.status}).`);
    }

    const catalog = (await response.json()) as BkperAiCatalog;
    if (!Array.isArray(catalog.data)) {
        throw new Error('Bkper AI model response is invalid.');
    }

    const defaultModelId = catalog.default_model ?? catalog.data[0]?.id;
    return catalog.data.map(model => toProviderModel(model, defaultModelId));
}

export function findDefaultBkperAiModel<TModel extends BkperAiModelMetadata>(
    models: readonly TModel[]
): TModel | undefined {
    return (
        models.find(
            model => model.provider === BKPER_AI_PROVIDER_ID && model.bkperDefault === true
        ) ?? models.find(model => model.provider === BKPER_AI_PROVIDER_ID)
    );
}

export function getBkperAiDefaultThinkingLevel(
    model: BkperAiModelMetadata | undefined
): BkperAiThinkingLevel | undefined {
    return model?.provider === BKPER_AI_PROVIDER_ID
        ? model.bkperDefaultThinkingLevel
        : undefined;
}

export function getBkperAiProviderConfig(
    env: Record<string, string | undefined> = process.env,
    fetchFn: typeof fetch = fetch
): ProviderConfig {
    const baseUrl = getBkperAiBaseUrlOverride(env) ?? BKPER_AI_PRODUCTION_BASE_URL;

    return {
        name: 'Bkper AI',
        baseUrl,
        apiKey: '!bkper auth token',
        authHeader: true,
        headers: {
            'bkper-agent-id': 'bkper-cli',
            'User-Agent': 'bkper-cli',
        },
        api: 'openai-responses',
        models: [],
        refreshModels: ({signal}) => fetchBkperAiModels(baseUrl, fetchFn, signal),
    };
}

export function registerBkperAiProvider(
    pi: Pick<ExtensionAPI, 'registerProvider'>,
    env: Record<string, string | undefined> = process.env
): void {
    pi.registerProvider(BKPER_AI_PROVIDER_ID, getBkperAiProviderConfig(env));
}
