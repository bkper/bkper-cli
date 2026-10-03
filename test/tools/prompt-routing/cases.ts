import type {PromptRoutingInput} from '../../../src/agent/prompt-routing.js';

/** Synthetic user-authored expectations, never included in classifier state. */
export interface PromptRoutingEvalCase extends PromptRoutingInput {
    id: string;
    expected: boolean;
}

export const EVAL_SCHEMA_VERSION = 1;

// Stable IDs make results comparable across changes. Add cases; do not renumber them.
export const CORE_CONCEPTS_EVAL_CASES: readonly PromptRoutingEvalCase[] = [
    {id: 'accounts-terse', prompt: 'accounts', recentUserMessages: [], expected: true},
    {id: 'transactions-terse', prompt: 'transactions', recentUserMessages: [], expected: true},
    {id: 'books-terse', prompt: 'books', recentUserMessages: [], expected: true},
    {id: 'bots-terse', prompt: 'bots', recentUserMessages: [], expected: true},
    {
        id: 'suppliers-debt',
        prompt: 'how much do I owe my suppliers?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'refund-basic',
        prompt: 'I got a refund, how should I record it?',
        recentUserMessages: [],
        expected: true,
    },
    {id: 'equity-basic', prompt: "what's equity?", recentUserMessages: [], expected: true},
    {
        id: 'bkper-cli-help',
        prompt: 'how do I use bkper from the terminal?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'context-bank-sync',
        prompt: "it's not syncing",
        recentUserMessages: ['I connected my bank to Bkper.'],
        expected: true,
    },
    {
        id: 'topic-change-explicit',
        prompt: 'forget accounting, help me with CSS grid',
        recentUserMessages: ['Review my books.'],
        expected: false,
    },
    {
        id: 'context-git',
        prompt: 'why did it fail?',
        recentUserMessages: ['I ran git push and got permission denied.'],
        expected: false,
    },
    {
        id: 'context-checked',
        prompt: 'can I edit it?',
        recentUserMessages: ['I checked a transaction in Bkper.'],
        expected: true,
    },
    {
        id: 'books-basic',
        prompt: "what's in my books?",
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'accounts-basic',
        prompt: 'show my accounts',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'transactions-review',
        prompt: 'can you review these transactions?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'balances-vague',
        prompt: 'something looks wrong with the balances',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bot-vague',
        prompt: "why isn't my bot working?",
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bot-no-effect',
        prompt: 'the bot ran but nothing changed',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bkper-setup',
        prompt: 'help me set up bkper',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bank-connect',
        prompt: 'how do I connect my bank?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'money-month',
        prompt: 'where did my money go this month?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'hiring-finance',
        prompt: 'can I afford to hire someone?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'customer-debt',
        prompt: 'how should I track what customers owe me?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'card-duplicate',
        prompt: 'I paid the card but the expense is showing twice',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'csv-reconcile',
        prompt: 'help me reconcile this CSV',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'checked-meaning',
        prompt: 'what does checked mean?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'exchange-bot-debug',
        prompt: 'the exchange bot is creating strange entries',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'inventory-bot-docs',
        prompt: 'review the inventory bot README',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'tax-calculation',
        prompt: 'is our tax calculation correct?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bkper-app-review',
        prompt: "I'm building a Bkper app; review how it handles events",
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bkper-permissions',
        prompt: 'why are my Bkper permissions not working?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'bkper-login',
        prompt: "why isn't bkper login working?",
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'portuguese-accounts',
        prompt: 'minhas contas estão certas?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'portuguese-bot',
        prompt: 'por que o bot não está funcionando?',
        recentUserMessages: [],
        expected: true,
    },
    {
        id: 'django-login-accounts',
        prompt: 'review the user login accounts in this Django app',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'postgres-transactions',
        prompt: 'why are PostgreSQL transactions deadlocking?',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'discord-bot',
        prompt: 'my Discord moderation bot stopped responding',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'reading-book',
        prompt: 'recommend a book to read',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'weather-docs',
        prompt: 'review the README for this weather app',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'typescript-import',
        prompt: 'fix this TypeScript import error',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'git-push',
        prompt: "why isn't git push working?",
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'button-style',
        prompt: 'make this button blue',
        recentUserMessages: [],
        expected: false,
    },
    {
        id: 'context-bkper-bot',
        prompt: 'can you review it?',
        recentUserMessages: ['I built a bot to record bank fees in Bkper.'],
        expected: true,
    },
    {
        id: 'context-discord-bot',
        prompt: "why isn't it working?",
        recentUserMessages: ['My Discord moderation bot ignores commands.'],
        expected: false,
    },
    {
        id: 'context-accounts',
        prompt: 'what about the other ones?',
        recentUserMessages: ['Can you review the accounts in my business book?'],
        expected: true,
    },
    {
        id: 'context-exchange-docs',
        prompt: 'review the README',
        recentUserMessages: ['We are updating the exchange bot.'],
        expected: true,
    },
    {
        id: 'context-weather-docs',
        prompt: 'review the README',
        recentUserMessages: ['I built a weather forecast app.'],
        expected: false,
    },
    {
        id: 'topic-change-database',
        prompt: 'now help me debug a PostgreSQL deadlock',
        recentUserMessages: ['Review my Bkper transactions.'],
        expected: false,
    },
    {
        id: 'context-credit-purchase',
        prompt: 'and how do I record that?',
        recentUserMessages: ['I bought supplies on a credit card.'],
        expected: true,
    },
    {
        id: 'context-app-review',
        prompt: 'can you check it?',
        recentUserMessages: ['My app posts transactions into Bkper.'],
        expected: true,
    },
];
