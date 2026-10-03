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
            "Is the user's present goal in `prompt` a finance/accounting task, a Bkper user task, or a task involving the meaning of Bkper's domain model? Use `recentUserMessages` to resolve ambiguous references, but follow explicit topic changes. For app and bot development, answer yes for financial/resource-flow business logic and no for technical infrastructure or general application work. The application's business area or use of Bkper does not by itself make technical work a domain task. Ambiguous Bkper app/bot troubleshooting, reviews, and documentation requests default to domain relevance unless the current task or recent context establishes a technical-only purpose. Do not assume that a documentation review is merely technical.",
        criteria: {
            true: 'Working with finance, money, accounting, bookkeeping, or inventory/resource movements; using or learning Bkper, including user setup, login, permissions, and connecting banks; designing, implementing, debugging, reviewing, explaining, or testing financial rules or Bkper data semantics. Examples of semantics are where resources move, which Accounts/Groups/Books represent a business process, transaction states, balances, taxes, valuation, payments, and refunds. In this CLI, unspecified books, accounts, transactions, checked entries, and bot problems default to Bkper domain tasks unless a different subject or technical cause is established. This includes general Bkper/bot documentation and README reviews whose scope is not limited to installation or tooling.',
            false: "The requested work is general software engineering, UI styling, framework/hosting choice, codebase organization, package installation, compiler/import errors, bundling/build configuration, HTTP routing, deployment/CI plumbing, or configuring the test harness rather than testing business rules. This remains no for Bkper apps/bots and financial products. Vague requests inherit the immediate task's technical subject, not the application's financial domain. Also no for clearly unrelated uses of account, transaction, book, or bot, and unrelated Git work.",
        },
    },
    fallback(input: PromptRoutingInput) {
        return [input.prompt, ...input.recentUserMessages].some(
            prompt => detectCoreConceptsPreloadLevel({prompt}) === 'full'
        );
    },
};
