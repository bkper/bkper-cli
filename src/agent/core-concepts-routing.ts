import type {PromptRoute, PromptRoutingInput} from './prompt-routing.js';

const DOCS_PATTERN =
    /\b(doc|docs|documentation|readme|guide|guides|example|examples|spec|specs|reference)\b/i;
const ANALYSIS_PATTERN =
    /\b(review|audit|validate|verify|critique|rewrite|document|describe|explain|design|model|map|check|spot)\b/i;
const AUTOMATION_PATTERN = /\b(bot|bots|app|apps|automation|automations)\b/i;
const BOT_PATTERN = /\b(bot|bots)\b/i;
const SEMANTIC_PATTERN =
    /\b(bkper|book|books|account|accounts|group|groups|transaction|transactions|balance|balances|incoming|outgoing|asset|assets|liability|liabilities|receivable|receivables|payable|payables|statement|statements|ledger|flow|flows|movement|movements|collection|collections|draft|drafts|checked|unchecked|posted|trashed|tax|taxes)\b/i;
const FINANCE_PATTERN =
    /\b(finance|financial|accounting|bookkeeping|money|bank|banking|cash|income|revenue|expense|expenses|budget|budgeting|invoice|invoices|payment|payments|loan|loans|debt|payroll|investment|investments|reconcile|reconciliation|credit|profit|loss|equity|inventory|owe|owed|afford|refund|refunds|salary|interest|dividend|dividends|fee|fees|deposit|deposits|withdrawal|withdrawals|cost|costs|receipt|receipts|contas|transações|transacoes|saldo|saldos|dinheiro|contabilidade)\b/i;

export type CoreConceptsPreloadLevel = 'none' | 'full';
export interface CoreConceptsPreloadInput {
    prompt: string;
}

/** Conservative keyword fallback only. Jev is the primary detector. */
export function detectCoreConceptsPreloadLevel(
    input: CoreConceptsPreloadInput
): CoreConceptsPreloadLevel {
    const prompt = input.prompt.trim();
    if (!prompt) return 'none';
    if (SEMANTIC_PATTERN.test(prompt) || FINANCE_PATTERN.test(prompt) || BOT_PATTERN.test(prompt))
        return 'full';
    if (
        (DOCS_PATTERN.test(prompt) || ANALYSIS_PATTERN.test(prompt)) &&
        AUTOMATION_PATTERN.test(prompt)
    )
        return 'full';
    return 'none';
}

export const CORE_CONCEPTS_ROUTE: PromptRoute = {
    id: 'bkper-core-concepts',
    threshold: 0.4,
    question: {
        type: 'bool',
        instructions:
            'Does the current request in `prompt` involve finance, accounting, bookkeeping, or require knowledge of Bkper? Use `recentUserMessages` only to resolve references and ambiguity, not to override an explicit change of topic. This user is interacting with the Bkper CLI agent: unspecified accounts, transactions, books, checked entries, and bots normally refer to Bkper, unless context clearly identifies another domain.',
        criteria: {
            true: 'Any finance/accounting request, or using, configuring, explaining, reviewing, or debugging Bkper, its data, apps, integrations, bots, or documentation. Includes informal requests about money and underspecified Bkper tasks.',
            false: 'Clearly unrelated work, including login accounts in other products, database transactions, reading books, non-Bkper bots, generic coding, styling, and Git issues. An unrelated current task remains unrelated even after earlier Bkper discussion.',
        },
    },
    fallback(input: PromptRoutingInput) {
        return [input.prompt, ...input.recentUserMessages].some(
            prompt => detectCoreConceptsPreloadLevel({prompt}) === 'full'
        );
    },
};
