import {expect} from '../../helpers/test-setup.js';
import type {ProviderConfig, ProviderModelConfig} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {
    findDefaultBkperAiModel,
    getBkperAiDefaultThinkingLevel,
    getBkperAiProviderConfig,
} from '../../../../src/agent/extensions/bkper-ai-provider.js';

function createRefreshContext(): Parameters<
    NonNullable<ProviderConfig['refreshModels']>
>[0] {
    return {
        allowNetwork: true,
        publish: async () => true,
        signal: new AbortController().signal,
    };
}

type ProviderChatModelConfig = Extract<ProviderModelConfig, {type?: 'chat'}>;
type ProviderClassifierModelConfig = Extract<ProviderModelConfig, {type: 'classifier'}>;

function isClassifierModel(model: ProviderModelConfig): model is ProviderClassifierModelConfig {
    return model.type === 'classifier';
}

/** Gateway decision entry as served by GET /v1/models. */
const jevCatalogEntry = {
    id: 'jev',
    type: 'decision',
    display_name: 'Jev 1.13',
    name: 'jev-1.13.0',
    input_modalities: ['text'],
    pricing: {inputNanoUsdPerToken: 53, outputNanoUsdPerToken: 0},
    context_window: 65536,
    max_state_question_tokens: 32768,
    question_types: ['noul', 'choice', 'score'],
};

function isChatModel(model: ProviderModelConfig): model is ProviderChatModelConfig {
    return model.type === undefined || model.type === 'chat';
}

/** Refreshes the catalog and asserts the provider only offers chat models. */
async function refreshChatModels(config: ProviderConfig): Promise<ProviderChatModelConfig[]> {
    const models = (await config.refreshModels?.(createRefreshContext())) ?? [];
    const chatModels = models.filter(isChatModel);
    expect(chatModels).to.have.length(models.length);
    return chatModels;
}

describe('agent/bkper-ai-provider', function () {
    it('provides models dynamically through Pi refreshModels', async function () {
        const fetchModels = sinon.stub().resolves(
            new Response(
                JSON.stringify({
                    object: 'list',
                    default_model: 'openai/gpt-5.6-luna',
                    data: [
                        {
                            id: 'openai/gpt-5.6-luna',
                            object: 'model',
                            display_name: 'GPT-5.6 Luna',
                            name: 'gpt-5.6-luna',
                            input_modalities: ['text', 'image'],
                            pricing: {
                                inputNanoUsdPerToken: 200,
                                cachedInputNanoUsdPerToken: 20,
                                cacheWriteNanoUsdPerToken: 250,
                                outputNanoUsdPerToken: 1200,
                            },
                            default_thinking_level: 'xhigh',
                            context_window: 272000,
                            max_output_tokens: 32000,
                            thinking_levels: ['high', 'xhigh', 'max'],
                        },
                        {
                            id: 'xai/grok-4.5',
                            object: 'model',
                            display_name: 'Grok 4.5',
                            input_modalities: ['text'],
                            pricing: {
                                inputNanoUsdPerToken: 2000,
                                cachedInputNanoUsdPerToken: 300,
                                cacheWriteNanoUsdPerToken: 0,
                                outputNanoUsdPerToken: 6000,
                            },
                            default_thinking_level: 'medium',
                            context_window: 200000,
                            max_output_tokens: 32000,
                            thinking_levels: ['low', 'medium', 'high'],
                        },
                    ],
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}}
            )
        );
        const config = getBkperAiProviderConfig(
            {BKPER_AI_BASE_URL: 'https://ai-dev.bkper.app/v1'},
            fetchModels
        );

        expect(config.models).to.deep.equal([]);
        const models = await refreshChatModels(config);

        expect(fetchModels.calledOnce).to.equal(true);
        expect(fetchModels.firstCall.args[0]).to.equal('https://ai-dev.bkper.app/v1/models');
        expect(models).to.have.length(1);
        expect(models?.[0]).to.deep.include({
            id: 'openai/gpt-5.6-luna',
            // The CLI labels models with the provider name of the revision served.
            name: 'gpt-5.6-luna',
            reasoning: true,
            input: ['text', 'image'],
            cost: {input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25},
            contextWindow: 272000,
            maxTokens: 32000,
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh',
        });
        expect(models?.[0]?.thinkingLevelMap).to.deep.equal({
            off: null,
            minimal: null,
            low: null,
            medium: null,
            high: 'high',
            xhigh: 'xhigh',
            max: 'max',
        });
        const runtimeModels = (models ?? []).map(model => ({...model, provider: 'bkper'}));
        expect(findDefaultBkperAiModel(runtimeModels)).to.equal(runtimeModels[0]);
        expect(getBkperAiDefaultThinkingLevel(runtimeModels[0])).to.equal('xhigh');
    });

    for (const defaultModel of ['text-only', undefined, 'vision-default']) {
        it(`selects a vision default when catalog default is ${defaultModel}`, async function () {
            const model = {
                pricing: {
                    inputNanoUsdPerToken: 0,
                    cachedInputNanoUsdPerToken: 0,
                    cacheWriteNanoUsdPerToken: 0,
                    outputNanoUsdPerToken: 0,
                },
                context_window: 128000,
                max_output_tokens: 8192,
                thinking_levels: [],
            };
            const config = getBkperAiProviderConfig({}, sinon.stub().resolves(
                new Response(JSON.stringify({
                    default_model: defaultModel,
                    data: [
                        {...model, id: 'text-only', input_modalities: ['text']},
                        {...model, id: 'unknown-modalities'},
                        {...model, id: 'vision-first', input_modalities: ['text', 'image']},
                        {...model, id: 'vision-default', input_modalities: ['text', 'image']},
                    ],
                }))
            ));

            const models = await config.refreshModels?.(createRefreshContext());

            expect(models?.map(model => model.id)).to.deep.equal([
                'vision-first',
                'vision-default',
            ]);
            const runtimeModels = (models ?? []).map(model => ({...model, provider: 'bkper'}));
            expect(findDefaultBkperAiModel(runtimeModels)?.id).to.equal(
                defaultModel === 'vision-default' ? 'vision-default' : 'vision-first'
            );
            expect(models?.filter(model => 'bkperDefault' in model && model.bkperDefault))
                .to.have.length(1);
        });
    }

    it('offers no models when none advertise image support', async function () {
        const config = getBkperAiProviderConfig({}, sinon.stub().resolves(
            new Response(JSON.stringify({
                default_model: 'text-only',
                data: [{
                    id: 'text-only',
                    input_modalities: ['text'],
                    pricing: {
                        inputNanoUsdPerToken: 0,
                        cachedInputNanoUsdPerToken: 0,
                        cacheWriteNanoUsdPerToken: 0,
                        outputNanoUsdPerToken: 0,
                    },
                    context_window: 128000,
                    max_output_tokens: 8192,
                    thinking_levels: [],
                }],
            }))
        ));

        expect(await config.refreshModels?.(createRefreshContext())).to.deep.equal([]);
    });

    it('offers decision models as System One classifiers beside chat models', async function () {
        const config = getBkperAiProviderConfig({}, sinon.stub().resolves(
            new Response(JSON.stringify({
                default_model: 'vision',
                data: [
                    // Image input must not route a decision model into the chat mapping.
                    {...jevCatalogEntry, id: 'jev-vision', input_modalities: ['text', 'image']},
                    jevCatalogEntry,
                    {
                        id: 'future-embedding',
                        type: 'embedding',
                        input_modalities: ['text', 'image'],
                        pricing: {inputNanoUsdPerToken: 1, outputNanoUsdPerToken: 0},
                        context_window: 8192,
                    },
                    {
                        id: 'vision',
                        object: 'model',
                        type: 'language',
                        input_modalities: ['text', 'image'],
                        pricing: {
                            inputNanoUsdPerToken: 0,
                            cachedInputNanoUsdPerToken: 0,
                            cacheWriteNanoUsdPerToken: 0,
                            outputNanoUsdPerToken: 0,
                        },
                        context_window: 128000,
                        max_output_tokens: 8192,
                        thinking_levels: ['low'],
                    },
                ],
            }))
        ));

        const models = (await config.refreshModels?.(createRefreshContext())) ?? [];

        expect(models.filter(isChatModel).map(model => model.id)).to.deep.equal(['vision']);
        const classifiers = models.filter(isClassifierModel);
        expect(classifiers.map(model => model.id)).to.deep.equal(['jev-vision', 'jev']);
        expect(classifiers[1]).to.deep.equal({
            type: 'classifier',
            id: 'jev',
            name: 'jev-1.13.0',
            api: 'typesafe-system-one',
            input: ['text'],
            cost: {input: 0.053, output: 0, cacheRead: 0, cacheWrite: 0},
            contextWindow: 65536,
        });
        expect(models).to.have.length(3);

        // Pi resolves a classifier model's api against the provider's classifiers map.
        for (const model of classifiers) {
            expect(config.classifiers?.[model.api ?? '']?.classify).to.be.a('function');
        }
    });

    it('enables cache warming only for models with a catalog prompt cache lifetime', async function () {
        const catalogModel = (id: string, promptCacheTtlSeconds?: unknown) => ({
            id,
            input_modalities: ['text', 'image'],
            pricing: {
                inputNanoUsdPerToken: 5000,
                cachedInputNanoUsdPerToken: 250,
                cacheWriteNanoUsdPerToken: 6300,
                outputNanoUsdPerToken: 25000,
            },
            context_window: 200000,
            max_output_tokens: 32000,
            thinking_levels: ['low', 'medium'],
            ...(promptCacheTtlSeconds === undefined
                ? {}
                : {prompt_cache_ttl_seconds: promptCacheTtlSeconds}),
        });
        const config = getBkperAiProviderConfig({}, sinon.stub().resolves(
            new Response(JSON.stringify({
                data: [
                    catalogModel('documented', 300),
                    catalogModel('undocumented'),
                    catalogModel('invalid', 0),
                ],
            }))
        ));

        const models = await refreshChatModels(config);

        expect(models.map(model => [model.id, model.promptCache])).to.deep.equal([
            ['documented', {short: 300}],
            ['undocumented', undefined],
            ['invalid', undefined],
        ]);
    });

    it('keeps mid-conversation system messages in place only for models the catalog marks', async function () {
        const catalogModel = (id: string, midConversationSystemMessages?: unknown) => ({
            id,
            input_modalities: ['text', 'image'],
            pricing: {
                inputNanoUsdPerToken: 5000,
                cachedInputNanoUsdPerToken: 250,
                cacheWriteNanoUsdPerToken: 6300,
                outputNanoUsdPerToken: 25000,
            },
            context_window: 200000,
            max_output_tokens: 32000,
            thinking_levels: ['low', 'medium'],
            ...(midConversationSystemMessages === undefined
                ? {}
                : {mid_conversation_system_messages: midConversationSystemMessages}),
        });
        const config = getBkperAiProviderConfig({}, sinon.stub().resolves(
            new Response(JSON.stringify({
                data: [
                    catalogModel('in-place', true),
                    catalogModel('folded'),
                    catalogModel('invalid', 'yes'),
                ],
            }))
        ));

        const models = await refreshChatModels(config);

        const keepsSystemMessagesInPlace = (model: ProviderChatModelConfig): boolean => {
            const compat = model.compat;
            return compat !== undefined &&
                'supportsMidConvoSystemMessages' in compat &&
                compat.supportsMidConvoSystemMessages === true;
        };
        expect(models.map(model => [model.id, keepsSystemMessagesInPlace(model)]))
            .to.deep.equal([
                ['in-place', true],
                ['folded', false],
                ['invalid', false],
            ]);
    });

    it('reports safe endpoint and status diagnostics for a non-JSON model catalog', async function () {
        const config = getBkperAiProviderConfig(
            {BKPER_AI_BASE_URL: 'https://ai-dev.bkper.app/v1'},
            sinon.stub().resolves(new Response('<!DOCTYPE html>private-response-value', {
                status: 200,
                headers: {'Content-Type': 'text/html'},
            }))
        );
        let error: unknown;
        try {
            await config.refreshModels?.(createRefreshContext());
        } catch (cause) {
            error = cause;
        }
        expect(error).to.be.instanceOf(Error);
        const message = (error as Error).message;
        expect(message).to.include('https://ai-dev.bkper.app/v1/models');
        expect(message).to.include('200');
        expect(message).to.include('text/html');
        expect(message).to.not.include('private-response-value');
    });

    it('reports a failed model request', async function () {
        const config = getBkperAiProviderConfig(
            {BKPER_AI_BASE_URL: 'https://ai-dev.bkper.app/v1'},
            sinon.stub().resolves(new Response('Unavailable', {status: 503}))
        );

        let error: unknown;
        try {
            await config.refreshModels?.(createRefreshContext());
        } catch (cause) {
            error = cause;
        }

        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('https://ai-dev.bkper.app/v1/models');
        expect((error as Error).message).to.include('503');
        expect((error as Error).message).to.not.include('Unavailable');
    });
});
