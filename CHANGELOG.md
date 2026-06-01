# Changelog

## 2026

### **June 2026**

-   **Authentication**
    -   `bkper auth login` now uses a Google verification URL and one-time code, so login works smoothly over SSH, in containers, and anywhere a localhost callback is inconvenient
    -   Removed the local callback server OAuth flow from CLI login

### **May 2026**

-   **App Development**
    -   Updated app development to use a unified server Worker lifecycle for web/API requests and event handling
    -   `bkper app build` now outputs the server Worker bundle to `dist/server`
    -   `bkper app dev` now proxies local client assets and emulates app outbound requests locally
    -   Added preview deployment guidance for testing app menus and events with `menuUrlDev` and `webhookUrlDev`
-   **App Logs**
    -   `bkper app logs` now accepts an optional app id, for example `bkper app logs my-app`
    -   Replaced outcome filtering with `--level info|warn|error`
-   **Authentication**
    -   OAuth login now falls back to another local callback port when the default port is already in use
-   **Agent Experience**
    -   Running bare `bkper` now starts the Bkper Agent in interactive terminals, while non-interactive invocations print CLI help
    -   Pi management commands now pass through with `bkper agent <command>`
-   **Data Management**
    -   Added `file upload` and `file get` commands for working with Book files from the CLI
    -   Added `transaction create --file` to attach a local file while creating a transaction
    -   Local file uploads now infer MIME types so PDFs and other known file types keep the correct `contentType`
    -   Transaction merge now uses the canonical merge implementation from the SDK

### **April 2026**

-   **App Platform**
    -   Added [`app logs`](https://bkper.com/docs/build/tools/cli) command to view recent web and events handler logs with filtering by time, handler, level, and status code

### **March 2026**

-   **Agent Experience**
    -   Running `bkper agent` now starts the embedded agent TUI (interactive terminals)
    -   Added startup maintenance for agent mode with background checks
-   **Pi Bridge**
    -   Added `bkper agent <pi-args...>` passthrough command to run Pi CLI features with Bkper defaults

### **February 2026**

-   **CLI**
    -   Added `--format` flag with `table`, `json`, and `csv` output modes — replaces the `--json` flag
    -   CSV output follows RFC 4180 — raw values, all metadata, no truncation, ideal for spreadsheets and data pipelines
    -   Batch operations via stdin — pipe JSON or CSV data into create commands for bulk processing
    -   Table-formatted output is now the default for all commands
    -   Added `-b, --book` option for scoping commands to a specific [Book](https://bkper.com/docs/guides/using-bkper/books)
    -   Added `-p, --properties` repeatable flag for setting custom properties as `key=value` pairs
    -   [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) tables show formatted dates and values with IDs
    -   [Group](https://bkper.com/docs/guides/using-bkper/groups) tables render as indented trees showing hierarchy
    -   Single-item commands display as indented key-value pairs
    -   Removed MCP server — now maintained as a separate project
-   **Data Management**
    -   Added batch create for [Account](https://bkper.com/docs/guides/using-bkper/accounts)s, [Group](https://bkper.com/docs/guides/using-bkper/groups)s, and [Transaction](https://bkper.com/docs/guides/using-bkper/transactions)s — accepts JSON arrays or CSV via stdin
    -   Added [Book](https://bkper.com/docs/guides/using-bkper/books) create command
    -   Added [Collection](https://bkper.com/docs/guides/using-bkper/collections) commands: create, list, get, update, delete, add-book, remove-book
    -   Added [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) update command
    -   Renamed `balance get` to `balance list` for consistency
-   **Authentication**
    -   Switched to PKCE-based OAuth flow — no client secret required
    -   Branded OAuth callback pages for a polished sign-in experience
-   **App Development**
    -   Local development now uses Cloudflare Tunnel for event handling — no cloud deployment needed during development
    -   Renamed `dev` environment to `preview` for clarity
    -   Added `--no-open` flag to suppress automatic browser launch during dev

### **January 2026**

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

## 2025

### **October 2025**

-   **MCP Server**
    -   Added smart [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) merging — combine multiple transactions based on date and account matching
    -   Simplified [Transaction](https://bkper.com/docs/guides/using-bkper/transactions) creation — accounts are now optional for recording simple income and expenses
    -   Improved transaction data responses for better AI assistant integration

### **September 2025**

-   **MCP Server**
    -   Streamlined transaction data for cleaner AI assistant responses
    -   Fixed credential storage to follow standard configuration directories

### **July 2025**

-   **MCP Server**
    -   Added monthly and year-to-date [Balance](https://bkper.com/docs/guides/using-bkper/chart-reports) analysis for AI assistants
    -   Improved date filtering with `before:` operator
    -   Added setup instructions for Claude Desktop and other AI tools

### **June 2025**

-   **CLI**
    -   Introduced MCP server — connect AI assistants to your Bkper [Books](https://bkper.com/docs/guides/using-bkper/books) with `bkper mcp start`
    -   Added [Book](https://bkper.com/docs/guides/using-bkper/books) name filtering to quickly find specific books
