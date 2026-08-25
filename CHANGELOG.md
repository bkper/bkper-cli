# Changelog

## [Unreleased]

## [4.29.0] - 2026-08-25

-   **Agent Experience**
    -   Added persistent global fuzzy input-history search with `Ctrl+R` in standard and handoff editors, and moved the session tree shortcut to `Ctrl+Alt+R`
    -   Changed handoff prompt-template completion to expand the selected prompt into the goal editor for review before starting the handoff
-   **App Development**
    -   Added cross-cutting app quality guidance for user interfaces, startup behavior, typed API contracts, module boundaries, security, and final implementation review

## [4.28.0] - 2026-08-24

-   **Agent Experience**
    -   Added native PowerShell support for the Bkper Agent on Windows, with automatic shell-tool selection and Bash fallback when needed
    -   Fixed `/connect` and `/disconnect` routing for external model providers after agent runtime updates
    -   Added safety guidance requiring AI-derived transactions to remain drafts until explicitly approved by a person
    -   Added prompt-template autocomplete and argument expansion to the handoff goal editor
-   **App Development**
    -   Added app security guidance for server-side authorization, including user-domain restrictions, Book permission allowlists, and app installation checks
    -   Expanded app architecture guidance for API ownership, canonical Bkper API types, and server-side authorization boundaries
-   **Installation**
    -   Improved npm package discovery and documented direct execution with `npx bkper`

## [4.27.0] - 2026-08-18

-   **Data Management**
    -   Added `bkper book copy <bookId>` with optional transaction and start-date copying
    -   Added `bkper transaction get <transactionId>` to retrieve one transaction directly by ID
    -   Added `bkper transaction uncheck <transactionId>` to make a checked transaction editable again
    -   Added `bkper transaction untrash <transactionId>` to restore a transaction from the trash

## [4.26.1] - 2026-08-17

-   **App Development**
    -   Added Bkper AI integration support for Platform apps, including local outbound authentication and app attribution, live model discovery, strict structured output, response validation, and error-preservation guidance
    -   Updated the built-in app-development context to discover and bundle individual canonical app guides from the lightweight documentation index

## [4.26.0] - 2026-08-16

-   **Agent Experience**
    -   Fixed `Ctrl+H` handoffs to prefill the goal editor with the current input text
-   **App Development**
    -   `bkper app init` now leaves dependency installation to the scaffold workflow and provides explicit coding-agent handoff instructions

## [4.25.0] - 2026-08-12

-   **App Development**
    -   Existing standalone apps with no Git remote can now migrate on `bkper app sync`, preserving the App identity and atomically uploading all local branches and tags

## [4.24.3] - 2026-08-12

-   **Agent Experience**
    -   Fixed `Ctrl+H` so the handoff shortcut remains available across agent sessions
-   **App Development**
    -   Added private Bkper-managed Git source for eligible standalone apps; `bkper app sync` configures the managed repository and pushes committed source, while apps with external remotes and monorepo apps keep their existing workflow
    -   Added `bkper app clone <appId> [path]` to safely clone managed app source without installing dependencies or running repository lifecycle scripts
    -   Managed `bkper app sync` and `bkper app deploy` now push committed source with clean-tree and fast-forward safety checks; deploy verifies the exact commit before uploading the existing local build
    -   `bkper app init` now initializes Git on `main` when needed without staging or committing files

## [4.24.1] - 2026-08-08

-   **Agent Experience**
    -   Fixed npm global installations failing to start agent mode when the Pi TUI dependency was nested

## [4.24.0] - 2026-08-08

-   **Agent Experience**
    -   Added `/handoff <goal>` and `Ctrl+H` to continue work in a linked, focused session with a generated context draft
    -   Added automatic handoff prompts before context compaction, enabled by default and independently configurable from `/settings`

## [4.22.0] - 2026-07-27

-   **Data Management**
    -   Added `bkper file delete <fileId>` to delete a Book file by ID

## [4.21.0] - 2026-07-24

-   **Agent Experience**
    -   Included Bkper AI models: GPT-5.6 Luna, GPT-5.6 Terra, and Grok 4.5
    -   Included Bkper AI models now use a 200,000-token managed context window to keep usage costs controlled

## [4.20.0] - 2026-07-19

-   **Agent Experience**
    -   New agent sessions now default to GPT-5.6 Terra with high thinking
    -   Bkper AI models now use fixed thinking levels to preserve consistent session caching; external providers remain configurable

## [4.19.0] - 2026-07-14

-   **Authentication**
    -   `bkper auth login` now identifies the authenticated account by email when available
-   **Agent Experience**
    -   `/login` and `/logout` now manage Bkper authentication, while `/connect` and `/disconnect` manage external model providers
    -   Bkper authentication now enables the included Bkper AI models by default
    -   Bkper AI model responses are capped at 32,000 output tokens
-   **Events**
    -   Added `bkper event list` to inspect Book events and bot responses, with date, resource, error, and event-type filters plus cursor pagination
    -   Added `bkper event replay <eventId>` to replay a bot response for a specific agent

## [4.18.1] - 2026-06-30

-   **Agent Integrations**
    -   Added Agent Skills discovery artifacts for the Bkper CLI skill

## [4.18.0] - 2026-06-26

-   **App Development**
    -   Added `bkper app get <appId>` to inspect a registered app by ID
-   **Agent Integrations**
    -   Added Codex plugin marketplace metadata for installing the Bkper CLI skill from this repository
    -   Added Claude Code plugin marketplace metadata for installing the Bkper CLI skill from this repository
    -   Agent mode now runs through a dedicated child entrypoint for cleaner CLI startup behavior
-   **Installation**
    -   Bkper CLI now requires Node.js `>=22.19.0` and shows a clear upgrade message on older Node.js versions

## [4.17.0] - 2026-06-18

-   **Data Management**
    -   Added `file list` with `--limit` and `--cursor` for paginated Book file discovery
    -   Added `--limit` and `--cursor` to `transaction list` for explicit one-page fetching while keeping the default full-query behavior
    -   Breaking: resource list commands with `--format json` now return an `{ "items": [...] }` envelope, with `cursor` included only when another page is available

## [4.16.0] - 2026-06-01

-   **Authentication**
    -   `bkper auth login` now uses a Google verification URL and one-time code, so login works smoothly over SSH, in containers, and anywhere a localhost callback is inconvenient
    -   Removed the local callback server OAuth flow from CLI login

## [4.15.0] - 2026-05-28

-   **App Development**
    -   Added preview deployment guidance for testing app menus and events with `menuUrlDev` and `webhookUrlDev`
-   **App Logs**
    -   `bkper app logs` now accepts an optional app id, for example `bkper app logs my-app`
    -   Replaced outcome filtering with `--level info|warn|error`
-   **Agent Experience**
    -   Running bare `bkper` now starts the Bkper Agent in interactive terminals, while non-interactive invocations print CLI help

## [4.14.0] - 2026-05-27

-   **App Development**
    -   Updated app development to use a unified server Worker lifecycle for web/API requests and event handling
    -   `bkper app build` now outputs the server Worker bundle to `dist/server`
    -   `bkper app dev` now proxies local client assets

## [4.13.7] - 2026-05-26

-   **App Development**
    -   `bkper app dev` now emulates app outbound requests locally

## [4.13.6] - 2026-05-26

-   **Agent Experience**
    -   Pi management commands now pass through with `bkper agent <command>`

## [4.13.1] - 2026-05-15

-   **Data Management**
    -   Transaction merge now uses the canonical merge implementation from the SDK

## [4.13.0] - 2026-05-13

-   **Authentication**
    -   OAuth login now falls back to another local callback port when the default port is already in use
-   **Data Management**
    -   Added `file upload` and `file get` commands for working with Book files from the CLI
    -   Added `transaction create --file` to attach a local file while creating a transaction
    -   Local file uploads now infer MIME types so PDFs and other known file types keep the correct `contentType`

## [4.12.27] - 2026-04-29

-   **App Platform**
    -   Added [`app logs`](https://bkper.com/docs/build/tools/cli) command to view recent web and events handler logs with filtering by time, handler, level, and status code

## [4.8.0] - 2026-03-17

-   **Agent Experience**
    -   Running `bkper agent` now starts the embedded agent TUI (interactive terminals)
    -   Added startup maintenance for agent mode with background checks
-   **Pi Bridge**
    -   Added `bkper agent <pi-args...>` passthrough command to run Pi CLI features with Bkper defaults

## [4.1.0] - 2026-02-15

-   **CLI**
    -   Added `--format` flag with `table`, `json`, and `csv` output modes — replaces the `--json` flag
    -   CSV output follows RFC 4180 — raw values, all metadata, no truncation, ideal for spreadsheets and data pipelines
    -   Batch operations via stdin — pipe JSON or CSV data into create commands for bulk processing
-   **Data Management**
    -   Added batch create for [Account](https://bkper.com/docs/guides/using-bkper/accounts)s, [Group](https://bkper.com/docs/guides/using-bkper/groups)s, and [Transaction](https://bkper.com/docs/guides/using-bkper/transactions)s — accepts JSON arrays or CSV via stdin

## [4.0.1] - 2026-02-11

-   **Data Management**
    -   Renamed `balance get` to `balance list` for consistency

## [4.0.0] - 2026-02-10

-   **CLI**
    -   Table-formatted output is now the default for all commands
    -   Added `-b, --book` option for scoping commands to a specific [Book](https://bkper.com/docs/guides/using-bkper/books)
    -   Added `-p, --properties` repeatable flag for setting custom properties as `key=value` pairs
    -   [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) tables show formatted dates and values with IDs
    -   [Group](https://bkper.com/docs/guides/using-bkper/groups) tables render as indented trees showing hierarchy
    -   Single-item commands display as indented key-value pairs
    -   Removed MCP server — now maintained as a separate project
-   **Data Management**
    -   Added [Book](https://bkper.com/docs/guides/using-bkper/books) create command
    -   Added [Collection](https://bkper.com/docs/guides/using-bkper/collections) commands: create, list, get, update, delete, add-book, remove-book
    -   Added [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) update command
-   **Authentication**
    -   Switched to PKCE-based OAuth flow — no client secret required
    -   Branded OAuth callback pages for a polished sign-in experience
-   **App Development**
    -   Local development now uses Cloudflare Tunnel for event handling — no cloud deployment needed during development
    -   Renamed `dev` environment to `preview` for clarity
    -   Added `--no-open` flag to suppress automatic browser launch during dev
-   **App Platform**
    -   Added [`app init`](https://bkper.com/docs/build/apps/deploying) command to scaffold new apps from template
    -   Added [`app deploy`](https://bkper.com/docs/build/apps/deploying) and [`app undeploy`](https://bkper.com/docs/build/apps/deploying) commands for managing deployments
    -   Added [`app status`](https://bkper.com/docs/build/apps/deploying) to view current deployment information
    -   Added [`app dev`](https://bkper.com/docs/build/apps/development) and [`app build`](https://bkper.com/docs/build/apps/deploying) commands for local development and build workflows
    -   Added [`app secrets`](https://bkper.com/docs/build/apps/deploying) management — put, list, and delete secrets for your apps
    -   Added [`app sync`](https://bkper.com/docs/build/apps/configuration) command to push `bkper.yaml` configuration to the platform
    -   Support for shared packages in monorepo setups with hot reload
    -   Asset file uploads included in deployments
    -   Migrated app configuration from `bkperapp.yaml` to `bkper.yaml`

## [3.6.0] - 2025-10-21

-   **MCP Server**
    -   Added smart [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) merging — combine multiple transactions based on date and account matching
    -   Simplified [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) creation — accounts are now optional for recording simple income and expenses
    -   Improved transaction data responses for better AI assistant integration

## [3.5.5] - 2025-09-11

-   **MCP Server**
    -   Streamlined transaction data for cleaner AI assistant responses

## [3.5.3] - 2025-09-03

-   **MCP Server**
    -   Fixed credential storage to follow standard configuration directories

## [3.4.0] - 2025-07-14

-   **CLI**
    -   Introduced MCP server — connect AI assistants to your Bkper [Books](https://bkper.com/docs/guides/using-bkper/books) with `bkper mcp start`
    -   Added [Book](https://bkper.com/docs/guides/using-bkper/books) name filtering to quickly find specific books
-   **MCP Server**
    -   Added monthly and year-to-date [Balance](https://bkper.com/docs/guides/using-bkper/chart-reports) analysis for AI assistants
    -   Improved date filtering with `before:` operator
    -   Added setup instructions for Claude Desktop and other AI tools
