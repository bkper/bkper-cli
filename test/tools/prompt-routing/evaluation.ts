import type {PromptRouteDecision} from '../../../src/agent/prompt-routing.js';
import type {PromptRoutingEvalCase} from './cases.js';

export interface PromptRoutingEvalResult extends PromptRoutingEvalCase {
    durationMs: number;
    decisions: Record<string, PromptRouteDecision>;
}

/** Provider failures are errors, never correct predictions or classifier misses. */
export function summarizeEvaluation(
    results: readonly PromptRoutingEvalResult[],
    routeId: string,
    threshold: number
) {
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let errors = 0;
    for (const result of results) {
        const decision = result.decisions[routeId];
        if (decision?.source !== 'classifier' || decision.probability === undefined) {
            errors++;
        } else if (decision.probability >= threshold) {
            if (result.expected) truePositives++;
            else falsePositives++;
        } else {
            if (result.expected) falseNegatives++;
            else trueNegatives++;
        }
    }
    return {threshold, truePositives, trueNegatives, falsePositives, falseNegatives, errors};
}
