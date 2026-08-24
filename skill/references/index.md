# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them.

For Bkper data, accounting, reporting, tax, or financial-flow tasks, read `core/core-concepts.md` first.

- `core/core-concepts.md` — canonical Bkper data model: resources, movements, balances, accounts, groups, books, transactions, properties, and the zero-sum invariant.
- `cli/data-management.md` — CLI reference for managing financial data and files: books, accounts, groups, files, transactions, per-account balance queries, query operators (on:, after:, before:, account:, group:), output formats (table/json/csv), human-review Bkper UI links, batch operations via stdin/piping, collections.
- `cli/app-management.md` — CLI reference for building and deploying Bkper apps: init/git clone/credential helpers, dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- `apps/overview.md` — Platform evaluation and capability overview: use when comparing managed Bkper hosting with self-managed infrastructure or clarifying platform responsibilities; use the task-specific app references for implementation.
- `apps/ai.md` — Bkper AI integration for Platform apps: authenticated `/api/*` request flow, outbound authorization and app attribution, live model discovery, strict structured output, response validation, error preservation, data minimization, and unit-test boundaries.
- `apps/first-app.md` — First-app walkthrough: scaffold, install, run locally, trigger an event, customize the listing, establish shared source, check, and deploy.
- `apps/architecture.md` — App and template architecture: npm workspace structure, Lit/Vite client, Hono Worker, typed `/api/*` contracts, authentication, `/events`, static assets, and supported app shapes.
- `apps/security.md` — App security responsibilities and server-side authorization: platform authentication boundaries, user-domain restrictions, Book permission allowlists, and app installation checks.
- `apps/configuration.md` — Complete `bkper.yaml` reference: identity, branding, ownership, access, context menus, event subscriptions, property schemas, and single-Worker deployment settings.
- `apps/development.md` — Local development: Vite and Worker processes, ports, API proxy, local authentication, secrets, KV, generated environment types, development loop, and debugging.
- `apps/event-handlers.md` — Event handler behavior: `/events` routing, responses, replay, loop prevention, platform and self-hosted authentication, event payloads, and event types.
- `apps/deploying.md` — Build, sync, and explicit deploy workflow; production and preview environments, secrets, KV, deployment status, and book installation.
- `apps/shared-app-source.md` — Bkper-managed private Git source: developer access, first sync, clone workflow, source/deployment separation, safety checks, external remotes, and monorepos.
- `apps/context-menu.md` — Book context-menu integration: production/development URLs, open modes, and dynamic Book, query, Account, and Group expressions.
- `apps/app-listing.md` — App listing metadata, visibility, publication review, end-user README guidance, and public listing locations.
- `apps/self-hosted.md` — Self-hosted event-handler alternatives: Cloud Functions, generic webhooks, direct authentication responsibilities, scaling, responses, and retries.
- `reporting/financial-statements.md` — Deterministic reporting principles and Bkper query semantics for balance sheet and P&L: trusted routes, root reporting groups, permanent vs period date rules, and provisional query patterns.
- `reporting/taxes.md` — Deterministic tax reporting principles: trusted routes, external tax-rule loading/discovery, user-approved tax-relevant groups/accounts, period activity queries, explicit jurisdiction assumptions, and provisional query patterns.
- `advisory/accountant-recommendations.md` — Human accountant / advisor recommendation flow using the OpenAccountants verified network endpoint: jurisdiction resolution, live JSON fetching, no-private-data handoff, profile_url introductions, no-match handling, and tax-review cross-reference.
- `sdk/bkper-js.md` — bkper-js Node.js/browser SDK: Bkper, Book, Account, Transaction, Group, Balance classes, all methods, getBalancesReport, OAuth configuration, library setup.
- `sdk/bkper-api-types.md` — Bkper REST API TypeScript interfaces: Book, Account, Transaction, Group, Balance, Collection, File — field names and types used by the API and bkper-js.
