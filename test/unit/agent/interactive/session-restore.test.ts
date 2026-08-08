import {expect} from '../../helpers/test-setup.js';
import {restorePersistedSessionOptions} from '../../../../src/agent/interactive/session-restore.js';

describe('persisted interactive session options', function () {
    it('starts an unconfigured session with the catalog default', function () {
        const claude = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const luna = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-luna',
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh' as const,
        };
        const models = [claude, luna];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => undefined,
                getDefaultProvider: () => undefined,
                getDefaultModel: () => undefined,
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {buildSessionContext: () => ({messages: []})}
        );

        expect(restored.model).to.equal(luna);
        expect(restored.thinkingLevel).to.equal('xhigh');
        expect(restored.scopedModels).to.deep.equal([]);
        expect(restored.diagnostics).to.deep.equal([]);
    });

    it('silently falls back a missing Bkper default to the catalog default', function () {
        const luna = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-luna',
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh' as const,
        };

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => undefined,
                getDefaultProvider: () => 'bkper',
                getDefaultModel: () => 'openai/gpt-5.6-sol',
            },
            {
                getAvailable: () => [luna],
                find: (provider: string, modelId: string) =>
                    provider === luna.provider && modelId === luna.id ? luna : undefined,
            },
            {buildSessionContext: () => ({messages: []})}
        );

        expect(restored.model).to.equal(luna);
        expect(restored.thinkingLevel).to.equal('xhigh');
        expect(restored.diagnostics).to.deep.equal([]);
    });

    it('silently falls back existing sessions to the catalog default', function () {
        const luna = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-luna',
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh' as const,
        };

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => undefined,
                getDefaultProvider: () => 'bkper',
                getDefaultModel: () => 'openai/gpt-5.6-sol',
            },
            {
                getAvailable: () => [luna],
                find: (provider: string, modelId: string) =>
                    provider === luna.provider && modelId === luna.id ? luna : undefined,
            },
            {
                buildSessionContext: () => ({
                    messages: [{role: 'user'}],
                    model: {provider: 'bkper', modelId: 'openai/gpt-5.6-sol'},
                }),
            }
        );

        expect(restored.model).to.equal(luna);
        expect(restored.thinkingLevel).to.equal('xhigh');
        expect(restored.diagnostics).to.deep.equal([]);
    });

    it('restores scoped models and reuses the saved default when it is in scope', function () {
        const claude = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const gemini = {provider: 'google', id: 'gemini-2.5-pro'};
        const models = [claude, gemini];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => [
                    'anthropic/claude-sonnet-4',
                    'google/gemini-2.5-pro',
                ],
                getDefaultProvider: () => 'google',
                getDefaultModel: () => 'gemini-2.5-pro',
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {buildSessionContext: () => ({messages: []})}
        );

        expect(restored.scopedModels.map(({model}) => `${model.provider}/${model.id}`)).to.deep
            .equal(['anthropic/claude-sonnet-4', 'google/gemini-2.5-pro']);
        expect(restored.model).to.equal(gemini);
        expect(restored.thinkingLevel).to.equal(undefined);
        expect(restored.diagnostics).to.deep.equal([]);
    });

    it('applies catalog thinking defaults while preserving explicit levels', function () {
        const luna = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-luna',
            bkperDefault: true,
            bkperDefaultThinkingLevel: 'xhigh' as const,
        };
        const terra = {
            provider: 'bkper',
            id: 'openai/gpt-5.6-terra',
            bkperDefault: false,
            bkperDefaultThinkingLevel: 'high' as const,
        };
        const grok = {
            provider: 'bkper',
            id: 'xai/grok-4.5',
            bkperDefault: false,
            bkperDefaultThinkingLevel: 'medium' as const,
        };
        const models = [luna, terra, grok];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => [
                    'bkper/openai/gpt-5.6-luna:max',
                    'bkper/openai/gpt-5.6-terra',
                    'bkper/xai/grok-4.5',
                ],
                getDefaultProvider: () => 'bkper',
                getDefaultModel: () => 'openai/gpt-5.6-terra',
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {buildSessionContext: () => ({messages: []})}
        );

        expect(restored.model).to.equal(terra);
        expect(restored.thinkingLevel).to.equal('high');
        expect(restored.scopedModels.map(scopedModel => scopedModel.thinkingLevel)).to.deep.equal([
            'max',
            'high',
            'medium',
        ]);
    });

    it('restores the first scoped model when the saved default is outside scope', function () {
        const claude = {provider: 'anthropic', id: 'claude-sonnet-4'};
        const gemini = {provider: 'google', id: 'gemini-2.5-pro'};
        const models = [claude, gemini];

        const restored = restorePersistedSessionOptions(
            {
                getEnabledModels: () => ['anthropic/claude-sonnet-4:high', 'google/gemini-2.5-pro'],
                getDefaultProvider: () => 'openai',
                getDefaultModel: () => 'gpt-5',
            },
            {
                getAvailable: () => models,
                find: (provider: string, modelId: string) =>
                    models.find(model => model.provider === provider && model.id === modelId),
            },
            {buildSessionContext: () => ({messages: []})}
        );

        expect(restored.model).to.equal(claude);
        expect(restored.thinkingLevel).to.equal('high');
        expect(restored.scopedModels[0]?.thinkingLevel).to.equal('high');
        expect(restored.scopedModels[1]?.thinkingLevel).to.equal(undefined);
    });
});
