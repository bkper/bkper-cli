import type {ClassifierBoolQuestion} from '@earendil-works/pi-ai';
import type {ModelRegistry, SessionProjection} from '@earendil-works/pi-coding-agent';

export const PROMPT_ROUTING_MODEL = {provider: 'bkper', id: 'jev'} as const;
export const PROMPT_ROUTING_TIMEOUT_MS = 5_000;
const MAX_PROMPT_CHARS = 16_000;
const MAX_RECENT_USER_MESSAGES = 3;
const MAX_CONTEXT_MESSAGE_CHARS = 2_000;

export interface PromptRoutingInput {
    prompt: string;
    recentUserMessages: string[];
}

/** Independent yes/no routes: more than one may match the same prompt. */
export interface PromptRoute {
    id: string;
    question: ClassifierBoolQuestion;
    threshold: number;
    fallback(input: PromptRoutingInput): boolean;
}

export interface PromptRouteDecision {
    load: boolean;
    source: 'classifier' | 'fallback';
    probability?: number;
    reason?: string;
}

export type PromptRoutingRegistry = Pick<ModelRegistry, 'getAvailableOfType' | 'classify'>;

/** Only user text from the current branch is sent; never tool output or images. */
export function buildPromptRoutingInput(
    prompt: string,
    messages: SessionProjection['messages'] = []
): PromptRoutingInput {
    const recentUserMessages: string[] = [];
    for (
        let i = messages.length - 1;
        i >= 0 && recentUserMessages.length < MAX_RECENT_USER_MESSAGES;
        i--
    ) {
        const message = messages[i];
        if (message.role !== 'user') continue;
        const text =
            typeof message.content === 'string'
                ? message.content
                : message.content
                      .filter(block => block.type === 'text')
                      .map(block => block.text)
                      .join('\n');
        if (text.trim()) recentUserMessages.unshift(text.slice(0, MAX_CONTEXT_MESSAGE_CHARS));
    }
    return {prompt: prompt.slice(0, MAX_PROMPT_CHARS), recentUserMessages};
}

/** One bounded Jev call for all pending questions, with a fallback per route. */
export async function evaluatePromptRoutes(
    input: PromptRoutingInput,
    routes: readonly PromptRoute[],
    registry: PromptRoutingRegistry,
    options: {timeoutMs?: number; signal?: AbortSignal} = {}
): Promise<Record<string, PromptRouteDecision>> {
    if (routes.length === 0) return {};
    const fallback = (route: PromptRoute, reason: string): PromptRouteDecision => ({
        load: route.fallback(input),
        source: 'fallback',
        reason,
    });
    const fallbackAll = (reason: string): Record<string, PromptRouteDecision> =>
        Object.fromEntries(routes.map(route => [route.id, fallback(route, reason)]));
    if (!input.prompt.trim()) return fallbackAll('Empty prompt.');

    const controller = new AbortController();
    const cancel = () => controller.abort('Routing cancelled.');
    let onAbort: () => void;
    const stopped = new Promise<Record<string, PromptRouteDecision>>(resolve => {
        onAbort = () => resolve(fallbackAll(String(controller.signal.reason)));
        controller.signal.addEventListener('abort', onAbort, {once: true});
    });
    options.signal?.addEventListener('abort', cancel, {once: true});
    const timer = setTimeout(
        () => controller.abort('Routing timed out.'),
        options.timeoutMs ?? PROMPT_ROUTING_TIMEOUT_MS
    );
    if (options.signal?.aborted) cancel();

    const classify = async (): Promise<Record<string, PromptRouteDecision>> => {
        try {
            if (controller.signal.aborted) return await stopped;
            const available = await registry.getAvailableOfType(
                'classifier',
                PROMPT_ROUTING_MODEL.provider,
                {signal: controller.signal}
            );
            if (controller.signal.aborted) return await stopped;
            const model = available.find(candidate => candidate.id === PROMPT_ROUTING_MODEL.id);
            if (!model) return fallbackAll('Jev unavailable.');
            const result = await registry.classify(
                model,
                {
                    state: {prompt: input.prompt, recentUserMessages: input.recentUserMessages},
                    questions: Object.fromEntries(routes.map(route => [route.id, route.question])),
                },
                {signal: controller.signal}
            );
            if (result.stopReason !== 'stop')
                return fallbackAll(result.errorMessage ?? result.stopReason);
            return Object.fromEntries(
                routes.map(route => {
                    const answer = result.answers[route.id];
                    const probability = answer?.type === 'bool' ? answer.probability : undefined;
                    const decision: PromptRouteDecision =
                        probability !== undefined &&
                        Number.isFinite(probability) &&
                        probability >= 0 &&
                        probability <= 1
                            ? {
                                  load: probability >= route.threshold,
                                  source: 'classifier',
                                  probability,
                              }
                            : fallback(route, 'Missing or invalid answer.');
                    return [route.id, decision];
                })
            );
        } catch (error) {
            return fallbackAll(error instanceof Error ? error.message : String(error));
        }
    };
    try {
        // Race as well as abort: misbehaving providers must not block a user prompt.
        return await Promise.race([classify(), stopped]);
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancel);
        controller.signal.removeEventListener('abort', onAbort!);
    }
}
