# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them.

For Bkper data, accounting, reporting, tax, or financial-flow tasks, read `core/core-concepts.md` first.

- `core/core-concepts.md` — canonical Bkper data model: resources, movements, balances, accounts, groups, books, transactions, properties, and the zero-sum invariant.
- `cli/data-management.md` — CLI reference for managing financial data and files: books, accounts, groups, files, transactions, per-account balance queries, query operators (on:, after:, before:, account:, group:), output formats (table/json/csv), human-review Bkper UI links, batch operations via stdin/piping, collections.
- `cli/app-management.md` — CLI reference for building and deploying Bkper apps: dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- `apps/app-building.md` — Full app-building reference: single Worker app architecture (`client/` + `server/`), development loop, `/api/*` routes, `/events` handlers, deployment patterns, the Bkper Platform, and self-hosted alternatives. Includes authentication patterns for web clients (`@bkper/web-auth`), server API routes (`Authorization: Bearer` on `/api/*` with outbound auth injection), platform event handlers (`new Bkper()` with outbound auth injection), and local development.
- `reporting/financial-statements.md` — Deterministic reporting principles and Bkper query semantics for balance sheet and P&L: trusted routes, root reporting groups, permanent vs period date rules, and provisional query patterns.
- `reporting/taxes.md` — Deterministic tax reporting principles: trusted routes, external tax-rule loading/discovery, user-approved tax-relevant groups/accounts, period activity queries, explicit jurisdiction assumptions, and provisional query patterns.
- `advisory/accountant-recommendations.md` — Human accountant / advisor recommendation flow using the OpenAccountants verified network endpoint: jurisdiction resolution, live JSON fetching, no-private-data handoff, profile_url introductions, no-match handling, and tax-review cross-reference.
- `sdk/bkper-js.md` — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, all methods, getBalancesReport, OAuth configuration, library setup.
- `sdk/bkper-api-types.md` — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection, File — field names and types used by the API and bkper-js.
