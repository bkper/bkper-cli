import type {
    BeforeAgentStartEvent,
    ExtensionAPI,
    ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../../helpers/test-setup.js';
import {
    registerPromptRoutingExtension,
    type PromptLoader,
} from '../../../../src/agent/extensions/prompt-routing.js';

function setup() {
    const on = sinon.stub();
    const router = registerPromptRoutingExtension({on: on as unknown as ExtensionAPI['on']});
    const run = on.firstCall.args[1] as (
        event: BeforeAgentStartEvent,
        ctx: ExtensionContext
    ) => Promise<void>;
    const getAvailableOfType = sinon.stub().resolves([{id: 'jev'}]);
    const classify = sinon
        .stub()
        .resolves({stopReason: 'stop', answers: {pending: {type: 'bool', probability: 0.9}}});
    const ctx = {
        modelRegistry: {getAvailableOfType, classify},
        sessionManager: {buildSessionProjection: () => ({messages: []})},
    } as unknown as ExtensionContext;
    const event: BeforeAgentStartEvent = {
        type: 'before_agent_start',
        prompt: 'review it',
        systemPrompt: '',
        systemPromptOptions: {
            cwd: '.',
            selectedTools: [],
            toolSnippets: {},
            toolGuidelines: {},
            promptGuidelines: [],
            appendSystemPrompt: '',
            sections: {},
            contextFiles: [],
            skills: [],
        },
    };
    return {router, run: () => run(event, ctx), getAvailableOfType, classify};
}

function loader(id: string, loaded: boolean): PromptLoader {
    return {
        id,
        threshold: 0.4,
        question: {
            type: 'bool',
            instructions: 'Is this relevant?',
            criteria: {true: 'Relevant', false: 'Unrelated'},
        },
        fallback: () => false,
        isLoaded: () => loaded,
        apply: sinon.spy(),
    };
}

describe('prompt loader router', function () {
    it('restores loaded sections and evaluates only pending loaders', async function () {
        const test = setup();
        const loaded = loader('loaded', true);
        const pending = loader('pending', false);
        test.router.registerLoader(loaded);
        test.router.registerLoader(pending);
        await test.run();
        expect(Object.keys(test.classify.firstCall.args[1].questions)).to.deep.equal(['pending']);
        expect((loaded.apply as sinon.SinonSpy).firstCall.args.slice(2)).to.deep.equal([
            true,
            true,
        ]);
        expect((pending.apply as sinon.SinonSpy).firstCall.args.slice(2)).to.deep.equal([
            true,
            false,
        ]);
    });

    it('does not consult the model registry when every loader is already loaded', async function () {
        const test = setup();
        const loaded = loader('loaded', true);
        test.router.registerLoader(loaded);
        await test.run();
        expect(test.getAvailableOfType.called).to.equal(false);
        expect((loaded.apply as sinon.SinonSpy).calledOnce).to.equal(true);
    });

    it('rejects duplicate IDs and invalid thresholds before sending questions', function () {
        const test = setup();
        test.router.registerLoader(loader('core', false));
        expect(() => test.router.registerLoader(loader('core', false))).to.throw(
            'already registered'
        );
        expect(() =>
            test.router.registerLoader({...loader('invalid', false), threshold: 1.1})
        ).to.throw('Invalid');
    });
});
