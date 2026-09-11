import {expect} from '../../helpers/test-setup.js';
import type {ProviderConfig} from '@earendil-works/pi-coding-agent';
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
        const models = await config.refreshModels?.(createRefreshContext());

        expect(fetchModels.calledOnce).to.equal(true);
        expect(fetchModels.firstCall.args[0]).to.equal('https://ai-dev.bkper.app/v1/models');
        expect(models).to.have.length(1);
        expect(models?.[0]).to.deep.include({
            id: 'openai/gpt-5.6-luna',
            name: 'GPT-5.6 Luna',
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
        expect((error as Error).message).to.equal('Bkper AI model request failed (503).');
    });
});
