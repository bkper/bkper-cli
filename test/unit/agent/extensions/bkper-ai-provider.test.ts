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
        store: {
            read: async () => undefined,
            write: async () => {},
            delete: async () => {},
        },
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
        expect(models).to.have.length(2);
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
