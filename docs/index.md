# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them. All docs are in the same directory as this index.

- **data-management.md** — CLI reference for managing financial data: books, accounts, groups, transactions, per-account balance queries, query operators (on:, after:, before:, account:, group:), output formats (table/json/csv), batch operations via stdin/piping, collections.
- **app-management.md** — CLI reference for building and deploying Bkper apps: dev/build/deploy workflow, app install/uninstall, secrets management, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- **financial-statements.md** — Step-by-step workflow for aggregate financial reports (balance sheet, P&L): root group discovery, query patterns, date semantics (before: vs after:+before:), common mistakes to avoid.
- **bkper-js.md** — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, all methods, getBalancesReport, OAuth configuration, library setup.
- **bkper-api-types.md** — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection — field names and types used by the API and bkper-js.
