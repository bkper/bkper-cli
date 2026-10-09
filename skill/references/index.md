# Bkper Docs Index

Reference docs for Bkper tasks. Load only the specific doc(s) relevant to the task — do not load all of them.

For Bkper app implementation, refactoring, or code review, always read `apps/quality.md` alongside the task-specific references. After implementation, review the changed code against the guidelines before considering the work complete.

- `cli/data-management.md` — CLI reference for managing financial data and files: books, accounts, groups, files, transactions, events and bot responses (bot errors, replay, delete), per-account balance queries, query operators (on:, after:, before:, account:, group:), JSON output shapes and jq reshaping, human-review Bkper UI links, batch operations via stdin/piping, collections.
- `cli/app-management.md` — CLI reference for building and deploying Bkper apps: init/git clone/credential helpers, dev/build/deploy workflow, app install/uninstall, secrets management, app logs, bkper.yaml configuration reference (identity, branding, events, menu integration, deployment).
- `apps/overview.md` — Platform evaluation and capability overview: use when comparing managed Bkper hosting with self-managed infrastructure or clarifying platform responsibilities; use the task-specific app references for implementation.
- `apps/ai.md` — Bkper AI in apps, scripts, and tools: ask the Jev decision model with TypeSafe's SDK or language models with AI SDK Open Responses, authenticate through app `/api/*` routes or a Bkper token outside the platform, handle errors, and keep Book writes under deterministic application control.
- `ai/decision-models.md` — Designing software around decision models: when to use one, the three kinds of question, a step-by-step workflow from facts to thresholds and human review, and a worked bank-line example. The request, answers, errors, and caching are in `api/ai-gateway.md`.
- `api/ai-gateway.md` — Bkper AI Gateway API guide: call Bkper AI language and decision models from your own client, script, or server — authentication, model IDs, requests, decision request rules and answer guarantees, streaming, errors, caching, and links to each operation's page.
- `api/managed-agent.md` — Bkper Managed Agent API guide: build apps, chat bots, and scripts on the agent behind Bkper Agent — sessions, instructions, inputs and idempotency, Book context, streams, files, a Slack bot example, limits, errors, and links to each operation's page.
- `apps/first-app.md` — First-app walkthrough: scaffold, install, run locally, trigger an event, customize the listing, establish shared source, check, and deploy.
- `apps/architecture.md` — App and template architecture: npm workspace structure, Lit/Vite client, Hono Worker, typed `/api/*` contracts, authentication, `/events`, static assets, and supported app shapes.
- `apps/quality.md` — Cross-cutting quality guidance for Bkper apps: UI consistency, immediate first rendering, typed API contracts, cohesive low-coupling modules, separation of business behavior from connectors and storage, security, and final implementation review. Load for app implementation, refactoring, or review tasks.
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
