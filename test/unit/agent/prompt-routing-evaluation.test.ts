import {expect} from '../helpers/test-setup.js';
import {CORE_CONCEPTS_EVAL_CASES} from '../../tools/prompt-routing/cases.js';
import {
    summarizeEvaluation,
    type PromptRoutingEvalResult,
} from '../../tools/prompt-routing/evaluation.js';

function row(expected: boolean, probability?: number): PromptRoutingEvalResult {
    return {
        id: 'test',
        prompt: 'test',
        recentUserMessages: [],
        expected,
        durationMs: 0,
        decisions: {
            core:
                probability === undefined
                    ? {source: 'fallback', load: expected, reason: 'Unavailable'}
                    : {source: 'classifier', load: probability >= 0.4, probability},
        },
    };
}

describe('prompt routing evaluations', function () {
    it('computes confusion counts deterministically and separates fallback errors', function () {
        const summary = summarizeEvaluation(
            [row(true, 0.9), row(false, 0.1), row(true, 0.2), row(false, 0.8), row(true)],
            'core',
            0.4
        );
        expect(summary).to.deep.equal({
            threshold: 0.4,
            truePositives: 1,
            trueNegatives: 1,
            falsePositives: 1,
            falseNegatives: 1,
            errors: 1,
        });
    });

    it('compares thresholds using probabilities, not previously computed load flags', function () {
        const results = [row(true, 0.45)];
        expect(summarizeEvaluation(results, 'core', 0.4).truePositives).to.equal(1);
        expect(summarizeEvaluation(results, 'core', 0.5).falseNegatives).to.equal(1);
    });

    it('gives every versioned case a unique stable ID', function () {
        expect(new Set(CORE_CONCEPTS_EVAL_CASES.map(fixture => fixture.id)).size).to.equal(
            CORE_CONCEPTS_EVAL_CASES.length
        );
    });
});
