import type {AgentSessionRuntimeDiagnostic} from '@earendil-works/pi-coding-agent';
import {
    BKPER_AI_PROVIDER_ID,
    findDefaultBkperAiModel,
    getBkperAiDefaultThinkingLevel,
    type BkperAiThinkingLevel,
} from '../extensions/bkper-ai-provider.js';

type ScopedThinkingLevel = BkperAiThinkingLevel;

type ModelLike = {
    provider: string;
    id: string;
    bkperDefault?: boolean;
    bkperDefaultThinkingLevel?: BkperAiThinkingLevel;
};

type ModelRegistryLike<TModel extends ModelLike = ModelLike> = {
    getAvailable(): TModel[];
    find(provider: string, modelId: string): TModel | undefined;
};

type SessionManagerLike = {
    buildSessionContext(): {
        messages: unknown[];
        model?: {
            provider: string;
            modelId: string;
        } | null;
    };
};

type PersistedModelSettings = {
    getEnabledModels(): string[] | undefined;
    getDefaultProvider(): string | undefined;
    getDefaultModel(): string | undefined;
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

function isSameModel(left: ModelLike, right: ModelLike): boolean {
    return left.provider === right.provider && left.id === right.id;
}

function isThinkingLevel(value: string): value is ScopedThinkingLevel {
    return ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value);
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
    settingsManager: PersistedModelSettings,
    modelRegistry: ModelRegistryLike<TModel>,
    sessionManager: SessionManagerLike
): RestoredPersistedSessionOptions<TModel> {
    const availableModels = modelRegistry.getAvailable();
    const sessionContext = sessionManager.buildSessionContext();
    const hasSessionMessages = sessionContext.messages.length > 0;
    const startupDefaultModel = findDefaultBkperAiModel(availableModels);
    const unavailableBkperSessionModel =
        sessionContext.model?.provider === BKPER_AI_PROVIDER_ID &&
        modelRegistry.find(sessionContext.model.provider, sessionContext.model.modelId) === undefined;
    const enabledModels = settingsManager.getEnabledModels();
    if (!enabledModels || enabledModels.length === 0) {
        if (hasSessionMessages) {
            return {
                model: unavailableBkperSessionModel ? startupDefaultModel : undefined,
                thinkingLevel:
                    unavailableBkperSessionModel && startupDefaultModel
                        ? getBkperAiDefaultThinkingLevel(startupDefaultModel)
                        : undefined,
                scopedModels: [],
                diagnostics: [],
            };
        }

        const defaultProvider = settingsManager.getDefaultProvider();
        const defaultModelId = settingsManager.getDefaultModel();
        const defaultModel =
            defaultProvider && defaultModelId
                ? modelRegistry.find(defaultProvider, defaultModelId)
                : undefined;
        const defaultThinkingLevel = defaultModel
            ? getBkperAiDefaultThinkingLevel(defaultModel)
            : undefined;
        const unavailableBkperDefault =
            defaultProvider === BKPER_AI_PROVIDER_ID &&
            defaultModelId !== undefined &&
            defaultModel === undefined;
        const fallbackStartupModel =
            (!defaultProvider && !defaultModelId) || unavailableBkperDefault
                ? startupDefaultModel
                : undefined;

        return {
            model: defaultThinkingLevel ? defaultModel : fallbackStartupModel,
            thinkingLevel:
                defaultThinkingLevel ??
                (fallbackStartupModel
                    ? getBkperAiDefaultThinkingLevel(fallbackStartupModel)
                    : undefined),
            scopedModels: [],
            diagnostics: [],
        };
    }

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

            const catalogThinkingLevel = getBkperAiDefaultThinkingLevel(model);
            scopedModels.push({
                model,
                thinkingLevel: thinkingLevel ?? catalogThinkingLevel,
            });
        }
    }

    if (hasSessionMessages) {
        return {
            model: unavailableBkperSessionModel ? startupDefaultModel : undefined,
            thinkingLevel:
                unavailableBkperSessionModel && startupDefaultModel
                    ? getBkperAiDefaultThinkingLevel(startupDefaultModel)
                    : undefined,
            scopedModels,
            diagnostics,
        };
    }

    if (scopedModels.length === 0) {
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
