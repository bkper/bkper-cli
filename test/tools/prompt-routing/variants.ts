import {CORE_CONCEPTS_ROUTE} from '../../../src/agent/core-concepts-routing.js';
import type {PromptRoute} from '../../../src/agent/prompt-routing.js';

/** Production and an explicitly versioned candidate share the same evaluation cases. */
export const CORE_CONCEPTS_EVAL_ROUTES: readonly PromptRoute[] = [
    CORE_CONCEPTS_ROUTE,
    {
        ...CORE_CONCEPTS_ROUTE,
        id: 'compact-v1',
        question: {
            type: 'bool',
            instructions:
                'Is knowledge of finance, accounting, or Bkper relevant to fulfilling `prompt`? This is a Bkper CLI conversation. Resolve vague references using `recentUserMessages`; unspecified accounts, transactions, books, and bots refer to Bkper unless explicitly about another domain. Follow the current request if the topic changes.',
            criteria: {
                true: 'Finance, accounting, money management, or Bkper usage, data, configuration, apps, bots, integrations, debugging, reviews, or documentation.',
                false: 'Unrelated tasks: generic development, Git, styling, login accounts in another product, database transactions, reading books, or explicitly non-Bkper bots.',
            },
        },
    },
];
