# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them. All docs are in the same directory as this index.

- **data-management.md** — CLI reference for managing financial data and files: books, accounts, groups, files, transactions, per-account balance queries, query operators (on:, after:, before:, account:, group:), output formats (table/json/csv), batch operations via stdin/piping, collections.
- **app-management.md** — CLI reference for building and deploying Bkper apps: dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- **app-building.md** — Full app-building reference: single Worker app architecture (`client/` + `server/`), development loop, `/api/*` routes, `/events` handlers, deployment patterns, the Bkper Platform, and self-hosted alternatives. Includes authentication patterns for web clients (`@bkper/web-auth`), server API routes (`Authorization: Bearer` on `/api/*` with outbound auth injection), platform event handlers (`new Bkper()` with outbound auth injection), and local development.
- **financial-statements.md** — Step-by-step workflow for aggregate financial reports (balance sheet, P&L): root group discovery, query patterns, date semantics (before: vs after:+before:), common mistakes to avoid.
- **taxes.md** — Deterministic workflow for tax position and filing summaries: discovering tax-relevant groups, period-based balance queries, persisting a local tax runner. Jurisdiction-agnostic — outputs raw period balances, leaving rate/application to the user.
- **bkper-js.md** — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, all methods, getBalancesReport, OAuth configuration, library setup.
- **bkper-api-types.md** — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection, File — field names and types used by the API and bkper-js.
