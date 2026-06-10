# Financial Statements — Deterministic Reporting

Use this guide when a user asks for a balance sheet, P&L, income statement, profit and loss, or another ledger-derived financial report from a Bkper Book.

## Principle

Financial statements are deterministic accounting work. For the same Book snapshot, statement type, period, and reporting assumptions, the same inputs must produce the same numbers.

Do not make raw LLM reasoning the final source of statement values. Use or establish a deterministic, auditable reporting route, then keep optional AI commentary separate from the computed statement.

Prefer existing trusted routes before creating new ones. A trusted route may be a script, CLI pipeline, platform app, bot, report config, template, or another project-standard artifact that the user already relies on.

If none exists, recommend the smallest auditable route that fits the user's context.

## Bkper statement semantics

Statements come from balances calculated from Transactions and organized by Groups.

| Statement | Accounts | Time basis | Query pattern |
| --- | --- | --- | --- |
| Balance Sheet | Asset and/or Liability | Position at a point in time | `group:'<root>' before:<date>` |
| P&L / Income Statement | Incoming and/or Outgoing | Activity during a period | `group:'<root>' after:<start> before:<end>` |

Rules:

- Use the relevant **root reporting group**. Do not silently substitute subgroups such as `Assets`, `Liabilities`, `Revenue`, or `Expenses` when the Book has a higher reporting root.
- Balance Sheet uses `before:` because permanent Accounts accumulate continuously.
- P&L uses `after:` + `before:` because non-permanent Accounts report activity within a period.
- `after:` is inclusive and `before:` is exclusive.
- Do not query the whole Book without a reporting group or account filter.

Date examples:

| Request | Balance Sheet | P&L |
| --- | --- | --- |
| Current month | `before:$m` | `after:$m-1 before:$m` |
| Current year | `before:$y` | `after:$y-1 before:$y` |
| Full year 2024 | `before:2025-01-01` | `after:2024-01-01 before:2025-01-01` |

`$m` and `$y` are Bkper query date variables for current month-end and current year-end. In shell commands, wrap queries containing `$` variables in single quotes to prevent shell expansion.

## Working route

Before computing a statement, inspect local project context for an existing reporting route:

- `AGENTS.md`
- `reports/`
- `scripts/`
- package scripts
- report config/spec files
- platform app or bot code

If a route exists, use it and pass explicit Book, statement, and date parameters. Do not rediscover groups or rebuild the report unless the user asks to change the reporting logic.

If no route exists, use read-only Bkper queries only for discovery and validation, then propose a repeatable route. Persist the decisions that make the report reproducible:

- Book ID
- statement type
- root group IDs and names
- date boundaries and timezone, when relevant
- output format
- detail/expansion level
- any local reporting assumptions

If the Book has no clear reporting hierarchy, treat that as a modeling gap. Do not invent a hierarchy silently. Inspect the Book's existing language and structure, propose the smallest hierarchy that fits the user's goal, and ask before changing Accounts or Groups.

## Examples & Patterns

Use the implementation style that matches the user's context:

- **Scripts & CLI** — best for local, inspectable, repeatable reports and lightweight project workflows.
- **Platform Apps / Bots** — best for shared, durable, event-driven, or operational reporting workflows.

Existing trusted reports or templates may be reused when they are already the user's accepted reporting route, but they are not required by this guide.

## Provisional answers

If the user explicitly wants a quick answer and does not want to establish a route, live read-only balance queries are acceptable. Label the result as **exploratory / provisional** and recommend a deterministic route for future repeatability.
