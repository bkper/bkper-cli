import path from 'node:path';
import {getAgentDir, ModelRuntime} from '@earendil-works/pi-coding-agent';
import {getBkperAiProviderConfig} from '../../../src/agent/extensions/bkper-ai-provider.js';
import {CORE_CONCEPTS_ROUTE} from '../../../src/agent/core-concepts-routing.js';
import {
    buildPromptRoutingInput,
    evaluatePromptRoutes,
    PROMPT_ROUTING_MODEL,
} from '../../../src/agent/prompt-routing.js';
import {CORE_CONCEPTS_EVAL_CASES, EVAL_SCHEMA_VERSION} from './cases.js';
import {summarizeEvaluation, type PromptRoutingEvalResult} from './evaluation.js';
import {CORE_CONCEPTS_EVAL_ROUTES} from './variants.js';

async function main(): Promise<void> {
    const runtime = await ModelRuntime.create({
        authPath: path.join(getAgentDir(), 'auth.json'),
        modelsPath: null,
        refreshOnCreate: false,
    });
    runtime.registerProvider(PROMPT_ROUTING_MODEL.provider, getBkperAiProviderConfig());
    const refresh = await runtime.refresh({
        providers: [PROMPT_ROUTING_MODEL.provider],
        allowNetwork: true,
        signal: AbortSignal.timeout(15_000),
    });
    const error = refresh.errors.get(PROMPT_ROUTING_MODEL.provider);
    if (error) throw error;
    if (refresh.aborted) throw new Error('Model catalog refresh timed out.');

    const results: PromptRoutingEvalResult[] = new Array(CORE_CONCEPTS_EVAL_CASES.length);
    let next = 0;
    // Bound concurrent requests; both question variants are evaluated in one call per case.
    await Promise.all(
        Array.from({length: 4}, async () => {
            while (next < CORE_CONCEPTS_EVAL_CASES.length) {
                const index = next++;
                const fixture = CORE_CONCEPTS_EVAL_CASES[index];
                const input = buildPromptRoutingInput(
                    fixture.prompt,
                    fixture.recentUserMessages.map((content, timestamp) => ({
                        role: 'user',
                        content,
                        timestamp,
                    }))
                );
                const started = Date.now();
                const decisions = await evaluatePromptRoutes(
                    input,
                    CORE_CONCEPTS_EVAL_ROUTES,
                    runtime,
                    {timeoutMs: 30_000}
                );
                results[index] = {...fixture, decisions, durationMs: Date.now() - started};
            }
        })
    );
    const evaluations = CORE_CONCEPTS_EVAL_ROUTES.map(route => ({
        id: route.id,
        question: route.question,
        threshold: route.threshold,
        thresholds: [0.3, 0.4, 0.5, 0.6, 0.7].map(threshold =>
            summarizeEvaluation(results, route.id, threshold)
        ),
    }));
    console.log(
        JSON.stringify(
            {
                schemaVersion: EVAL_SCHEMA_VERSION,
                evaluatedAt: new Date().toISOString(),
                model: PROMPT_ROUTING_MODEL,
                cases: results.length,
                evaluations,
                results,
            },
            null,
            2
        )
    );
    // Candidate mismatches are expected during experiments; only production misses and errors fail.
    const production = summarizeEvaluation(
        results,
        CORE_CONCEPTS_ROUTE.id,
        CORE_CONCEPTS_ROUTE.threshold
    );
    const errors = CORE_CONCEPTS_EVAL_ROUTES.some(
        route => summarizeEvaluation(results, route.id, route.threshold).errors > 0
    );
    if (errors || production.falsePositives + production.falseNegatives > 0) process.exitCode = 1;
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
