# Taxes — Deterministic Reporting

Use this guide when a user asks to do taxes, compute a tax position, prepare a filing summary, or reconcile tax-related balances from a Bkper Book.

## Principle

Tax reporting is deterministic accounting work, but tax law is jurisdiction-specific. Do not invent rates, deductions, filing rules, or tax categories from general knowledge.

Do not make raw LLM reasoning the final source of tax numbers. Use or establish a deterministic, auditable route, then keep optional AI commentary separate from computed values.

A tax route may compute tax owed only when the applicable rules, rates, and assumptions are supplied by the user or encoded in a reviewed deterministic artifact. Otherwise, produce raw period data or a filing worksheet for the user or their advisor to apply local rules.

Prefer existing trusted routes before creating new ones. If none exists, recommend the smallest auditable route that fits the user's context.

## Loading tax rules

When no trusted local tax route exists, or when the user asks to load jurisdiction rules, use external tax-rule libraries only as discovery sources. They may identify candidate rates, thresholds, deadlines, forms, classifications, and citations, but they are not a final computation route.

Do not produce tax numbers from loaded rules until the rule source, tax period, assumptions, and Bkper mappings have been reviewed or approved.

Preferred non-MCP OpenAccountants route:

1. Start from `https://www.openaccountants.com/llms.txt`.
2. Resolve the jurisdiction code, such as `BR`, `GB`, `DE`, `US-CA`, or `CA-ON`.
3. Fetch `https://www.openaccountants.com/api/bundle/<CODE>`.
4. Do not use MCP unless the user explicitly requests it.
5. Record source URL, retrieval date, tax year, quality tier, verifier if present, and citations.
6. Map rules only to user-approved Bkper Groups, Accounts, properties, or hashtags.

Example: for Brazil, resolve `BR` and fetch `https://www.openaccountants.com/api/bundle/BR`, then clarify whether the scope is IRPF, Carnê-Leão, payroll, indirect tax, e-invoice compliance, or another Brazil tax area.

## Bkper tax semantics

Tax reports usually combine period activity with tax-account positions or movements.

| Need | Time basis | Query pattern |
| --- | --- | --- |
| Revenue / income activity | Period activity | `group:'<revenueRoot>' after:<start> before:<end>` |
| Deductible cost / expense activity | Period activity | `group:'<expenseRoot>' after:<start> before:<end>` |
| Tax account movements | Period activity | `account:'<taxAccount>' after:<start> before:<end>` |
| Tax liability / credit balance | Position at period end | `account:'<taxAccount>' before:<end>` |

Rules:

- Use user-approved tax-relevant Groups and Accounts. Do not assume standard names such as `Revenue`, `VAT`, `Taxes`, or `Deductible Expenses` are correct for the Book.
- Period activity uses `after:` + `before:`.
- Tax liability or credit Accounts may need either period movements or an end balance, depending on the question.
- `after:` is inclusive and `before:` is exclusive.
- Do not query the whole Book without a tax-relevant group or account filter.

Date examples:

| Request | Period activity query |
| --- | --- |
| Current month | `after:$m-1 before:$m` |
| Current year | `after:$y-1 before:$y` |
| Full year 2024 | `after:2024-01-01 before:2025-01-01` |
| Last quarter | Resolve to explicit `after:<start> before:<end>` boundaries |

`$m` and `$y` are Bkper query date variables for current month-end and current year-end. In shell commands, wrap queries containing `$` variables in single quotes to prevent shell expansion.

## Working route

Before computing a tax position, inspect local project context for an existing tax route:

- `AGENTS.md`
- `reports/`
- `scripts/`
- package scripts
- tax config/spec files
- platform app or bot code

If a route exists, use it and pass explicit Book, period, and supported override parameters. Do not rediscover tax Groups or rebuild the logic unless the user asks to change it.

If no route exists, clarify the user's goal and recommend a repeatable route. Persist the decisions that make the tax run reproducible:

- Book ID
- tax period and timezone, when relevant
- tax-relevant Group and Account IDs and names
- balance-level or transaction-level detail
- output format
- jurisdiction-specific rules, rates, and assumptions, if supplied

If the Book has no clear tax-relevant grouping, treat that as a modeling gap. Do not invent tax categories silently. Inspect the Book's existing language and structure, propose the smallest grouping that fits the user's goal, and ask before changing Accounts or Groups.

## Examples & Patterns

Use the implementation style that matches the user's context:

- **Scripts & CLI** — best for local, inspectable tax worksheets, reconciliations, and lightweight repeatable summaries.
- **Platform Apps / Bots** — best for shared, durable, event-driven tax automation such as applying configured tax rules when Transactions are posted.

Existing trusted reports or templates may be reused when they are already the user's accepted tax route, but they are not required by this guide.

## Provisional answers

If the user explicitly wants a quick answer and does not want to establish a route, live read-only queries are acceptable. Label the result as **exploratory / provisional** and avoid applying unsupplied tax law.
