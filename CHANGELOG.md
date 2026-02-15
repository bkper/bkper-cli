# Changelog

## 2026

### **February 2026**

-   **CLI**
    -   Added `--format` flag with `table`, `json`, and `csv` output modes — replaces the `--json` flag
    -   CSV output follows RFC 4180 — raw values, all metadata, no truncation, ideal for spreadsheets and data pipelines
    -   Batch operations via stdin — pipe JSON or CSV data into create commands for bulk processing
    -   Table-formatted output is now the default for all commands
    -   Added `-b, --book` option for scoping commands to a specific [Book](https://bkper.com/docs)
    -   Added `-p, --properties` repeatable flag for setting custom properties as `key=value` pairs
    -   [Transaction](https://bkper.com/docs) tables show formatted dates and values with IDs
    -   [Group](https://bkper.com/docs) tables render as indented trees showing hierarchy
    -   Single-item commands display as indented key-value pairs
    -   Removed MCP server — now maintained as a separate project
-   **Data Management**
    -   Added batch create for [Account](https://bkper.com/docs)s, [Group](https://bkper.com/docs)s, and [Transaction](https://bkper.com/docs)s — accepts JSON arrays or CSV via stdin
    -   Added [Book](https://bkper.com/docs) create command
    -   Added [Collection](https://bkper.com/docs) commands: create, list, get, update, delete, add-book, remove-book
    -   Added [Transaction](https://bkper.com/docs) update command
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
    -   Added [`app init`](https://bkper.com/docs) command to scaffold new apps from template
    -   Added [`app deploy`](https://bkper.com/docs) and [`app undeploy`](https://bkper.com/docs) commands for managing deployments
    -   Added [`app status`](https://bkper.com/docs) to view current deployment information
    -   Added [`app dev`](https://bkper.com/docs) and [`app build`](https://bkper.com/docs) commands for local development and build workflows
    -   Added [`app secrets`](https://bkper.com/docs) management — put, list, and delete secrets for your apps
    -   Added [`app sync`](https://bkper.com/docs) command to push `bkper.yaml` configuration to the platform
    -   Support for shared packages in monorepo setups with hot reload
    -   Asset file uploads included in deployments
    -   Migrated app configuration from `bkperapp.yaml` to `bkper.yaml`

## 2025

### **October 2025**

-   **MCP Server**
    -   Added smart [Transaction](https://bkper.com/docs) merging — combine multiple transactions based on date and account matching
    -   Simplified [Transaction](https://bkper.com/docs) creation — accounts are now optional for recording simple income and expenses
    -   Improved transaction data responses for better AI assistant integration

### **September 2025**

-   **MCP Server**
    -   Streamlined transaction data for cleaner AI assistant responses
    -   Fixed credential storage to follow standard configuration directories

### **July 2025**

-   **MCP Server**
    -   Added monthly and year-to-date [Balance](https://bkper.com/docs) analysis for AI assistants
    -   Improved date filtering with `before:` operator
    -   Added setup instructions for Claude Desktop and other AI tools

### **June 2025**

-   **CLI**
    -   Introduced MCP server — connect AI assistants to your Bkper [Books](https://bkper.com/docs) with `bkper mcp start`
    -   Added [Book](https://bkper.com/docs) name filtering to quickly find specific books
