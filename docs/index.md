# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them. All docs are in the same directory as this index.

- **data-management.md** — CLI reference for managing financial data: books, accounts, groups, transactions, per-account balance queries, query operators (on:, after:, before:, account:, group:), output formats (table/json/csv), batch operations via stdin/piping, collections.
- **app-management.md** — CLI reference for building and deploying Bkper apps: dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- **app-building.md** — Full app-building reference: architecture (packages, client/server/events), development loop, event handlers, deployment patterns, the Bkper Platform, and self-hosted alternatives. Includes authentication patterns for web clients (`@bkper/web-auth`), event handlers (`bkper-oauth-token` headers), and local development. Load this for scaffolding apps, understanding app structure, or debugging the dev/build/deploy lifecycle.
- **financial-statements.md** — Step-by-step workflow for aggregate financial reports (balance sheet, P&L): root group discovery, query patterns, date semantics (before: vs after:+before:), common mistakes to avoid.
- **taxes.md** — Deterministic workflow for tax position and filing summaries: discovering tax-relevant groups, period-based balance queries, persisting a local tax runner. Jurisdiction-agnostic — outputs raw period balances, leaving rate/application to the user.
- **bkper-js.md** — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, all methods, getBalancesReport, OAuth configuration, library setup.
- **bkper-api-types.md** — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection — field names and types used by the API and bkper-js.
