import type {
    BeforeAgentStartEvent,
    ExtensionAPI,
    ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
    buildPromptRoutingInput,
    evaluatePromptRoutes,
    type PromptRoute,
} from '../prompt-routing.js';

/** Loaders own injection and persistence; the router only owns prompt decisions. */
export interface PromptLoader extends PromptRoute {
    isLoaded(ctx: ExtensionContext): boolean;
    apply(
        event: BeforeAgentStartEvent,
        ctx: ExtensionContext,
        load: boolean,
        alreadyLoaded: boolean
    ): void;
}

export interface PromptLoaderRouter {
    registerLoader(loader: PromptLoader): void;
}

export function registerPromptRoutingExtension(pi: Pick<ExtensionAPI, 'on'>): PromptLoaderRouter {
    const loaders: PromptLoader[] = [];
    pi.on('before_agent_start', async (event, ctx) => {
        const states = loaders.map(loader => ({loader, loaded: loader.isLoaded(ctx)}));
        const pending = states.filter(state => !state.loaded).map(state => state.loader);
        const decisions =
            pending.length > 0
                ? await evaluatePromptRoutes(
                      buildPromptRoutingInput(
                          event.prompt,
                          ctx.sessionManager.buildSessionProjection().messages
                      ),
                      pending,
                      ctx.modelRegistry,
                      {signal: ctx.signal}
                  )
                : {};
        for (const {loader, loaded} of states) {
            loader.apply(event, ctx, loaded || decisions[loader.id]?.load === true, loaded);
        }
    });
    return {
        registerLoader(loader) {
            if (loaders.some(existing => existing.id === loader.id)) {
                throw new Error(`Prompt loader already registered: ${loader.id}`);
            }
            if (
                !Number.isFinite(loader.threshold) ||
                loader.threshold < 0 ||
                loader.threshold > 1
            ) {
                throw new Error(`Invalid prompt routing threshold: ${loader.id}`);
            }
            loaders.push(loader);
        },
    };
}
