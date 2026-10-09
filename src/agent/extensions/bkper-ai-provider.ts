import type {
    ExtensionAPI,
    ProviderConfig,
    ProviderModelConfig,
} from '@earendil-works/pi-coding-agent';
import {typesafeSystemOneApi} from '../pi-shared-modules.js';

export const BKPER_AI_PROVIDER_ID = 'bkper';
export const BKPER_AI_PRODUCTION_BASE_URL = 'https://ai.bkper.app/v1';

const BKPER_AI_BASE_URL_ENV_VAR = 'BKPER_AI_BASE_URL';
const BKPER_AI_DEVELOPMENT_ORIGIN = 'https://ai-dev.bkper.app';
const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const BKPER_AI_CLASSIFIER_API = 'typesafe-system-one';

export type BkperAiThinkingLevel = (typeof THINKING_LEVELS)[number];

export interface BkperAiModelMetadata {
    provider: string;
    bkperDefault?: boolean;
    bkperDefaultThinkingLevel?: BkperAiThinkingLevel;
}

/** The chat member of Pi's provider model union; the package root exports only the union. */
type ProviderChatModelConfig = Extract<ProviderModelConfig, {type?: 'chat'}>;

/** The classifier member of Pi's provider model union. */
type ProviderClassifierModelConfig = Extract<ProviderModelConfig, {type: 'classifier'}>;

interface BkperAiModelConfig extends ProviderChatModelConfig {
    bkperDefault: boolean;
    bkperDefaultThinkingLevel?: BkperAiThinkingLevel;
}

/** A gateway chat model; the catalog marks these `language` or omits `type`. */
interface BkperAiCatalogModel {
    id: string;
    type?: string;
    /** Provider name of the revision served behind the versionless `id`, e.g. `gpt-6-luna`. */
    name?: string;
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
    prompt_cache_ttl_seconds?: number;
    /** The gateway keeps later system messages at their position, preserving the cached prefix. */
    mid_conversation_system_messages?: boolean;
}

/** A gateway decision model, served through the System One classify API. */
interface BkperAiDecisionCatalogModel {
    id: string;
    type: 'decision';
    name?: string;
    pricing: {
        inputNanoUsdPerToken: number;
        outputNanoUsdPerToken: number;
    };
    context_window: number;
}

interface BkperAiCatalog {
    default_model?: string;
    data: Array<BkperAiCatalogModel | BkperAiDecisionCatalogModel>;
}

function isDecisionModel(
    model: BkperAiCatalogModel | BkperAiDecisionCatalogModel
): model is BkperAiDecisionCatalogModel {
    return model.type === 'decision';
}

function isChatModel(
    model: BkperAiCatalogModel | BkperAiDecisionCatalogModel
): model is BkperAiCatalogModel {
    return model.type === undefined || model.type === 'language';
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
): NonNullable<ProviderChatModelConfig['thinkingLevelMap']> {
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
    ) ?? [];

    return {
        id: model.id,
        name: model.name ?? model.id,
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
        ...getPromptCache(model.prompt_cache_ttl_seconds),
        contextWindow: model.context_window,
        maxTokens: model.max_output_tokens,
        compat: {
            supportsDeveloperRole: false,
            sessionAffinityFormat: 'openai',
            supportsLongCacheRetention: false,
            // Otherwise Pi folds prompt changes into the leading system prompt.
            ...(model.mid_conversation_system_messages === true
                ? {supportsMidConvoSystemMessages: true}
                : {}),
        },
        bkperDefault: model.id === defaultModelId,
        bkperDefaultThinkingLevel: getDefaultThinkingLevel(model),
    };
}

function toClassifierModel(model: BkperAiDecisionCatalogModel): ProviderClassifierModelConfig {
    return {
        type: 'classifier',
        id: model.id,
        name: model.name ?? model.id,
        api: BKPER_AI_CLASSIFIER_API,
        input: ['text'],
        cost: {
            input: nanoUsdPerTokenToUsdPerMillion(model.pricing.inputNanoUsdPerToken),
            output: nanoUsdPerTokenToUsdPerMillion(model.pricing.outputNanoUsdPerToken),
            cacheRead: 0,
            cacheWrite: 0,
        },
        contextWindow: model.context_window,
    };
}

/**
 * Maps the catalog's prompt cache lifetime to Pi's cache warming metadata.
 * Models without a valid lifetime stay ineligible for cache warming.
 */
function getPromptCache(
    ttlSeconds: number | undefined
): Pick<BkperAiModelConfig, 'promptCache'> {
    return typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? {promptCache: {short: ttlSeconds}}
        : {};
}

async function fetchBkperAiModels(
    baseUrl: string,
    fetchFn: typeof fetch,
    signal?: AbortSignal
): Promise<Array<BkperAiModelConfig | ProviderClassifierModelConfig>> {
    const url = `${baseUrl}/models`;
    const response = await fetchFn(url, {signal});
    const contentType = response.headers.get('content-type') ?? 'unknown content type';
    const responseInfo = `${url} (HTTP ${response.status}, ${contentType})`;
    if (!response.ok) {
        throw new Error(`Bkper AI model request failed: ${responseInfo}.`);
    }

    let catalog: BkperAiCatalog;
    try {
        catalog = (await response.json()) as BkperAiCatalog;
    } catch {
        // Keep response bodies out of diagnostics, including JSON parse error snippets.
        throw new Error(`Expected JSON Bkper AI model response from ${responseInfo}.`);
    }
    if (!Array.isArray(catalog.data)) {
        throw new Error('Bkper AI model response is invalid.');
    }

    // Split by type first: decision entries lack the chat fields toProviderModel reads.
    const classifierModels = catalog.data.filter(isDecisionModel).map(toClassifierModel);
    const chatModels = catalog.data
        .filter(isChatModel)
        .filter(model => model.input_modalities?.includes('image'));
    const defaultModelId =
        chatModels.find(model => model.id === catalog.default_model)?.id ?? chatModels[0]?.id;
    return [
        ...chatModels.map(model => toProviderModel(model, defaultModelId)),
        ...classifierModels,
    ];
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
            'bkper-ai-source': 'bkper-cli',
            'User-Agent': 'bkper-cli',
        },
        api: 'openai-responses',
        classifiers: {[BKPER_AI_CLASSIFIER_API]: typesafeSystemOneApi()},
        // Every model type arrives through refreshModels, so the static list stays empty.
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
