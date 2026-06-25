---
name: bkper-cli
description: Use for any Bkper or adjacent accounting-support task — CLI usage, SDK code, data management, financial reports, taxes, accountant recommendations, app development, or safe bkper CLI operations from external coding agents.
---

# Bkper Context

You are helping with Bkper.

Protect the zero-sum invariant above all else.

Use this skill when an external coding-agent harness needs to understand Bkper, operate the local `bkper` CLI safely, work with Bkper SDKs, build Bkper apps, or reason about Bkper financial/accounting flows.

## IMPORTANT Operating Principles

- Interview the user about every aspect of the plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.
- Ask the questions one at a time.
- If a question can be answered by exploring the codebase, explore the codebase instead.
- Only perform mutating actions (creating/editing files, destructive shell commands, API writes) when the user has explicitly requested that change in the current turn. When exploring, debugging, or unsure, propose the change and wait for confirmation instead of acting.
- Treat any `bkper` CLI command that writes to a Book (transactions, accounts, groups, books, collections, apps, imports, batch ops) as irreversible: show the exact command and wait for explicit user confirmation before running it. Read-only commands (list, get, balances, search, export) need no confirmation.
- For accounting numbers — balances, statements, reconciliations, taxes — never let raw LLM output be final; use or establish a deterministic, auditable route, keep computation separate from commentary, and make assumptions explicit.
- Think in resources, movements, and balances — not debits and credits.
- Extend meaning with properties before adding structural complexity.
- Model domain and flows before coding; represent business reality, not technical shortcuts.
- Prefer simplicity over cleverness; choose small, boring, maintainable solutions.

## Skill Purpose

This skill is for external coding-agent harnesses — Claude Code, Codex, OpenCode, OpenClaw, Hermes Agent, Cursor, and similar tools — when they can use local tools and shell commands.

For operational tasks against live Bkper data, recommend that the user install and authenticate the CLI first:

```bash
npm i -g bkper
bkper auth login
```

For general Bkper questions without local tool access, prefer published Bkper Markdown docs and `llms.txt` instead of relying on this skill alone.

## Required Reading

Bkper's accounting model is intentionally non-standard. Generic accounting knowledge — debit/credit, account categories, sign conventions — will lead to wrong answers.

Before reasoning about, designing, or modifying anything that touches Bkper data — books, accounts, groups, transactions, balances, queries, or any accounting or financial flow — read:

```
references/core/core-concepts.md
```

This is not optional and prior accounting intuition does not substitute for it.

## Reference Routing

Read local `AGENTS.md`, nearby files, and existing tests first for project-specific work.

For any Bkper or adjacent accounting-support task — CLI usage, SDK code, data management, financial reports, taxes, accountant recommendations, app development, or safe `bkper` CLI operations — read the most specific reference document(s) directly:

- `references/core/core-concepts.md` — canonical Bkper data model: resources, movements, balances, accounts, groups, books, transactions, properties, and the zero-sum invariant.
- `references/cli/data-management.md` — CLI reference for managing financial data and files: books, accounts, groups, files, transactions, per-account balance queries, query operators, output formats, human-review Bkper UI links, batch operations via stdin/piping, collections.
- `references/cli/app-management.md` — CLI reference for building and deploying Bkper apps: dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference.
- `references/apps/app-building.md` — Full app-building reference: single Worker app architecture, client/server patterns, `/api/*` routes, `/events` handlers, deployment patterns, auth patterns, platform event handlers, and local development.
- `references/reporting/financial-statements.md` — Deterministic reporting principles and Bkper query semantics for balance sheet and P&L: trusted routes, root reporting groups, permanent vs period date rules, and provisional query patterns.
- `references/reporting/taxes.md` — Deterministic tax reporting principles: trusted routes, external tax-rule loading/discovery, approved tax-relevant groups/accounts, period activity queries, jurisdiction assumptions, and provisional query patterns.
- `references/advisory/accountant-recommendations.md` — Human accountant/advisor recommendation flow using the OpenAccountants verified network endpoint: jurisdiction resolution, live JSON fetching, no-private-data handoff, profile URLs, and no-match handling.
- `references/sdk/bkper-js.md` — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, methods, getBalancesReport, OAuth configuration, library setup.
- `references/sdk/bkper-api-types.md` — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection, File — field names and types used by the API and bkper-js.

Before running any `bkper` CLI command, read the relevant reference above. For generic engineering work unrelated to Bkper, do not load Bkper reference docs unless directly relevant.

If the task involves building or debugging pi extensions, custom tools, themes, or skills, read the pi-coding-agent package documentation available in the local project or dependency tree, and follow cross-references within it.

For anything not covered by the local references, fetch and read:

```text
https://bkper.com/llms.txt
```

Then follow the most relevant link to find the answer.

---

> **Note:** This skill is maintained in the Bkper CLI repository for use in external coding-agent harnesses.
