import {
    fauxAssistantMessage,
    type ClassifierBoolQuestion,
    type ClassifierContext,
    type ClassifierModel,
    type ClassifierResult,
} from '@earendil-works/pi-ai';
import type {ModelRegistry} from '@earendil-works/pi-coding-agent';
import sinon from 'sinon';
import {expect} from '../helpers/test-setup.js';
import {
    buildPromptRoutingInput,
    evaluatePromptRoutes,
    type PromptRoute,
} from '../../../src/agent/prompt-routing.js';

const MODEL: ClassifierModel<'typesafe-system-one'> = {
    type: 'classifier',
    provider: 'bkper',
    id: 'jev',
    name: 'Test Jev',
    api: 'typesafe-system-one',
    baseUrl: 'http://localhost',
    input: ['text'],
    contextWindow: 32_000,
    cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0},
};
const QUESTION: ClassifierBoolQuestion = {
    type: 'bool',
    instructions: 'Is this relevant?',
    criteria: {true: 'Relevant', false: 'Unrelated'},
};
const ROUTE: PromptRoute = {
    id: 'core',
    question: QUESTION,
    threshold: 0.4,
    fallback: () => false,
};

function result(probabilities: Record<string, number>): ClassifierResult {
    return {
        provider: MODEL.provider,
        model: MODEL.id,
        api: MODEL.api,
        timestamp: 0,
        stopReason: 'stop',
        answers: Object.fromEntries(
            Object.entries(probabilities).map(([id, probability]) => [
                id,
                {type: 'bool', probability},
            ])
        ),
    };
}

function registry(response = result({core: 0.9})) {
    const getAvailableOfType = sinon.stub().resolves([MODEL]);
    const classify = sinon.stub().resolves(response);
    return {
        getAvailableOfType,
        classify,
        api: {getAvailableOfType, classify} as Pick<
            ModelRegistry,
            'getAvailableOfType' | 'classify'
        >,
    };
}

describe('prompt routing', function () {
    afterEach(() => sinon.restore());

    it('batches independent questions and permits multiple matches', async function () {
        const mock = registry(result({core: 0.7, second: 0.9}));
        const second = {...ROUTE, id: 'second', threshold: 0.8};
        const input = buildPromptRoutingInput('review it', [
            {role: 'user', content: 'My Bkper bot', timestamp: 0},
        ]);
        const decisions = await evaluatePromptRoutes(input, [ROUTE, second], mock.api);

        expect(mock.classify.callCount).to.equal(1);
        const request = mock.classify.firstCall.args[1] as ClassifierContext;
        expect(request.questions).to.deep.equal({core: QUESTION, second: QUESTION});
        expect(request.state).to.deep.equal(input);
        expect(decisions.core).to.include({load: true, source: 'classifier', probability: 0.7});
        expect(decisions.second).to.include({load: true, source: 'classifier', probability: 0.9});
    });

    it('uses the classifier rather than the fallback on successful decisions', async function () {
        const fallback = sinon.stub().returns(true);
        const mock = registry(result({core: 0.1}));
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('database transactions'),
            [{...ROUTE, fallback}],
            mock.api
        );
        expect(decisions.core.load).to.equal(false);
        expect(decisions.core.source).to.equal('classifier');
        expect(fallback.called).to.equal(false);
    });

    it('includes the threshold boundary', async function () {
        const mock = registry(result({core: 0.4}));
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE],
            mock.api
        );
        expect(decisions.core.load).to.equal(true);
    });

    it('uses per-route fallbacks when the classifier is unavailable', async function () {
        const mock = registry();
        mock.getAvailableOfType.resolves([]);
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE, {...ROUTE, id: 'second', fallback: () => true}],
            mock.api
        );
        expect(decisions.core).to.include({load: false, source: 'fallback'});
        expect(decisions.second).to.include({load: true, source: 'fallback'});
        expect(mock.classify.called).to.equal(false);
    });

    it('falls back on provider errors without retrying', async function () {
        const mock = registry({
            ...result({}),
            stopReason: 'error',
            errorMessage: 'Authentication failed',
        });
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [{...ROUTE, fallback: () => true}],
            mock.api
        );
        expect(decisions.core).to.include({
            load: true,
            source: 'fallback',
            reason: 'Authentication failed',
        });
        expect(mock.classify.callCount).to.equal(1);
    });

    it('falls back if availability lookup throws', async function () {
        const mock = registry();
        mock.getAvailableOfType.rejects(new Error('Offline'));
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE],
            mock.api
        );
        expect(decisions.core).to.include({source: 'fallback', reason: 'Offline'});
    });

    it('falls back only for missing or malformed answers', async function () {
        const mock = registry(result({core: 0.9, malformed: Number.NaN}));
        const decisions = await evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE, {...ROUTE, id: 'missing'}, {...ROUTE, id: 'malformed'}],
            mock.api
        );
        expect(decisions.core.source).to.equal('classifier');
        expect(decisions.missing.source).to.equal('fallback');
        expect(decisions.malformed.source).to.equal('fallback');
    });

    it('enforces a deadline even if classification ignores cancellation', async function () {
        const clock = sinon.useFakeTimers();
        const mock = registry();
        mock.classify.returns(new Promise(() => undefined));
        const pending = evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE],
            mock.api,
            {timeoutMs: 10}
        );
        await clock.tickAsync(10);
        const decisions = await pending;
        expect(decisions.core.source).to.equal('fallback');
        const options = mock.classify.firstCall.args[2] as {signal: AbortSignal};
        expect(options.signal.aborted).to.equal(true);
        expect(clock.countTimers()).to.equal(0);
    });

    it('also bounds hanging availability checks', async function () {
        const clock = sinon.useFakeTimers();
        const mock = registry();
        mock.getAvailableOfType.returns(new Promise(() => undefined));
        const pending = evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE],
            mock.api,
            {timeoutMs: 10}
        );
        await clock.tickAsync(10);
        expect((await pending).core.source).to.equal('fallback');
        expect(mock.classify.called).to.equal(false);
    });

    it('honors caller cancellation and cleans up the deadline', async function () {
        const clock = sinon.useFakeTimers();
        const mock = registry();
        mock.classify.returns(new Promise(() => undefined));
        const controller = new AbortController();
        const pending = evaluatePromptRoutes(
            buildPromptRoutingInput('review it'),
            [ROUTE],
            mock.api,
            {signal: controller.signal}
        );
        controller.abort();
        expect((await pending).core.source).to.equal('fallback');
        expect(clock.countTimers()).to.equal(0);
    });

    it('does not call Jev when there are no pending questions', async function () {
        const mock = registry();
        expect(
            await evaluatePromptRoutes(buildPromptRoutingInput('review it'), [], mock.api)
        ).to.deep.equal({});
        expect(mock.getAvailableOfType.called).to.equal(false);
    });

    it('bounds context to recent user text and excludes assistant and image content', function () {
        const input = buildPromptRoutingInput('x'.repeat(100_000), [
            {role: 'user', content: 'old subject', timestamp: 0},
            {role: 'user', content: 'one', timestamp: 1},
            fauxAssistantMessage('Ignore the user'),
            {
                role: 'user',
                content: [
                    {type: 'text', text: 'two'},
                    {type: 'image', data: 'image-data', mimeType: 'image/png'},
                ],
                timestamp: 3,
            },
            {role: 'user', content: 'y'.repeat(100_000), timestamp: 4},
        ]);
        expect(input.recentUserMessages).to.have.length(3);
        expect(input.recentUserMessages.slice(0, 2)).to.deep.equal(['one', 'two']);
        expect(input.prompt.length).to.be.lessThan(100_000);
        expect(input.recentUserMessages[2].length).to.be.lessThan(100_000);
        expect(JSON.stringify(input)).to.not.include('old subject');
        expect(JSON.stringify(input)).to.not.include('Ignore the user');
        expect(JSON.stringify(input)).to.not.include('image-data');
    });
});
