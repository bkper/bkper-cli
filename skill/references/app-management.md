[bkper.yaml reference]: #bkperyaml-reference
[App Template]: https://github.com/bkper/bkper-app-template

# App Management

Build, deploy, and manage Bkper apps using the `bkper` CLI.

---

## Verification Workflow

When scaffolding, developing, or deploying an app, verify each step before proceeding. This prevents broken deployments and silent failures.

### 1. Init

```bash
bkper app init my-app
```

Verify:

- `client/` and `server/` exist
- `bkper.yaml` has `id`, `name`, `description`, and `developers`
- `package.json` scripts include `dev` and `build`

### 2. Develop

```bash
npm run dev
```

Verify:

- Server worker responds: `curl http://localhost:8787/health` (or the port you configured)
- Client dev server is reachable if running separately
- If the app declares `events`, the events tunnel URL is printed in terminal and registered in Bkper as `webhookUrlDev`
- If the worker fails to start, fix before writing code

### 3. Build

```bash
npm run build
```

Verify:

- `dist/server/` contains the server Worker bundle
- `dist/client/` contains the Vite client build when `deployment.client` is configured
- No build errors in terminal output

### 4. Sync & Deploy

```bash
bkper app sync && bkper app deploy
```

Verify:

- `bkper app status` shows the deployed version
- URLs in `bkper.yaml` match the deployed domain (`https://{appId}.bkper.app`)

#### Preview testing with menu and events

To test a preview deployment from the Bkper UI, keep production URLs unchanged and point the development URLs to the preview Worker:

```yaml
menuUrl: https://{appId}.bkper.app?bookId=${book.id}
menuUrlDev: https://{appId}-preview.bkper.app?bookId=${book.id}

webhookUrl: https://{appId}.bkper.app/events
webhookUrlDev: https://{appId}-preview.bkper.app/events
```

Then build, sync metadata, and deploy to preview:

```bash
npm run build
bkper app sync
bkper app deploy --preview
```

Bkper uses `menuUrlDev` for developer menu access and `webhookUrlDev` for development-mode events. If `bkper app dev` runs later, it may replace `webhookUrlDev` with a local tunnel URL; set it back to the preview URL and run `bkper app sync` before testing preview again.

### 5. Validate

```bash
bkper app install <appId> -b <bookId>
```

Verify:

- Menu appears in the book's "More" menu (if configured)
- App server `/api/*` routes are called with `Authorization: Bearer <token>`
- Trigger a subscribed event in the book
- Check the Bkper activity stream for the handler response
- If the handler writes back to the book, confirm loop prevention is in place (check `event.agent.id`)

---

## Development Workflow

```bash
# Scaffold a new app from the template
bkper app init my-app

# Start the worker runtime (Miniflare + tunnel + file watching)
# In your project, use "npm run dev" to run both Vite and the worker concurrently
bkper app dev

# Build the server Worker bundle
# In your project, use "npm run build" to build both client (Vite) and worker
bkper app build

# Sync configuration and deploy to production
bkper app sync && bkper app deploy

# Inspect a registered app by id
bkper app get <appId>
bkper app get <appId> --json

# Deploy to preview environment (URL: https://{appId}-preview.bkper.app)
bkper app deploy --preview

# Check deployment status
bkper app status
```

> **Note:** `bkper app dev` runs one local Worker runtime — Miniflare, file watching, and an optional Cloudflare tunnel to `/events` when the app subscribes to events. Miniflare is loaded from the app project's `devDependencies` so each app can keep its local Workers simulator aligned with its own code. The Vite client dev server is configured in the project's `vite.config.ts` and run separately. The project template composes both via `npm run dev` using `concurrently`. If needed, install Miniflare in the app root with `bun add -d miniflare` or `npm install -D miniflare`.

---

## Install Apps on Books

```bash
# Install an app on a book
bkper app install my-app -b abc123

# Uninstall an app from a book
bkper app uninstall my-app -b abc123
```

---

## Secrets

```bash
# Store a secret (prompts for value)
bkper app secrets put EXTERNAL_SERVICE_TOKEN

# List all secrets
bkper app secrets list

# Delete a secret
bkper app secrets delete EXTERNAL_SERVICE_TOKEN
```

Use `--preview` to manage preview secrets.

---

## Configuration

Apps are configured via a `bkper.yaml` file in the project root. See the complete **[bkper.yaml reference]** below.

<details>
<summary>bkper.yaml reference</summary>

```yaml
# =============================================================================
# bkper.yaml Reference
# =============================================================================
# This file documents all available configuration options for Bkper Apps.
# Copy the fields you need to your app's bkper.yaml file.
#
# For a minimal working template, see:
# https://github.com/bkper/bkper-app-template
# =============================================================================

# -----------------------------------------------------------------------------
# APP IDENTITY
# -----------------------------------------------------------------------------
# The app id is permanent and cannot be changed after creation.
# Use lowercase letters, numbers, and hyphens only.
id: my-app

# Display name shown in the Bkper UI
name: My App

# Brief description of what the app does
description: A Bkper app that does something useful

# -----------------------------------------------------------------------------
# BRANDING
# -----------------------------------------------------------------------------
# App logo for light mode (SVG recommended, PNG/JPG supported)
logoUrl: https://example.com/logo.svg

# App logo for dark mode (required for proper theming)
logoUrlDark: https://example.com/logo-dark.svg

# App website or documentation URL
website: https://example.com

# -----------------------------------------------------------------------------
# OWNERSHIP
# -----------------------------------------------------------------------------
# Developer/company name
ownerName: Your Name

# Owner's logo/avatar URL
ownerLogoUrl: https://example.com/owner-logo.png

# Owner's website
ownerWebsite: https://yoursite.com

# Source code repository URL
repoUrl: https://github.com/you/my-app

# Whether the repository is private
repoPrivate: true

# Mark as deprecated (hides from app listings, existing installs continue working)
deprecated: false

# -----------------------------------------------------------------------------
# ACCESS CONTROL
# -----------------------------------------------------------------------------
# Who can update the app configuration and deploy new versions.
# Comma-separated list of Bkper usernames (not emails).
# Supports domain wildcards for registered custom domains: *@yourdomain.com
developers: victor, aldo, *@bkper.com

# Who can install and use the app.
# Same format as developers. Leave empty for public apps.
users: maria, *@acme.com

# -----------------------------------------------------------------------------
# MENU INTEGRATION (optional)
# -----------------------------------------------------------------------------
# When configured, adds a menu item to Bkper's "More" menu.
# Clicking opens a popup with the specified URL.

# Production menu URL (supports variable substitution)
menuUrl: https://${id}.bkper.app?bookId=${book.id}

# Development menu URL (used when developer runs the app)
menuUrlDev: http://localhost:8787?bookId=${book.id}

# Custom menu text (defaults to app name if not specified)
menuText: Open My App

# Popup dimensions in pixels
menuPopupWidth: 500
menuPopupHeight: 300

# -----------------------------------------------------------------------------
# Menu URL Variables
# -----------------------------------------------------------------------------
# The following variables can be used in menuUrl and menuUrlDev:
#
# ${book.id}                - Current book ID
# ${book.properties.xxx}    - Book property value (replace xxx with property key)
# ${account.id}             - Selected account ID (in account context)
# ${account.properties.xxx} - Account property value
# ${group.id}               - Selected group ID (in group context)
# ${group.properties.xxx}   - Group property value
# ${transactions.ids}       - Comma-separated selected transaction IDs
# ${transactions.query}     - Current search query
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# EVENT HANDLING (optional)
# -----------------------------------------------------------------------------
# When configured, Bkper calls your webhook URL when subscribed events occur.
# On the Bkper Platform, /events is handled by the same Worker as /api/*.

# Production webhook URL
webhookUrl: https://${id}.bkper.app/events

# Development webhook URL (auto-updated by bkper app dev)
webhookUrlDev: https://<random>.trycloudflare.com/events

# API version for event payloads
apiVersion: v5

# Events to subscribe to (remove events you don't need)
events:
    # Transaction
    - TRANSACTION_CREATED
    - TRANSACTION_POSTED
    - TRANSACTION_CHECKED
    - TRANSACTION_UNCHECKED
    - TRANSACTION_UPDATED
    - TRANSACTION_DELETED
    - TRANSACTION_RESTORED
    # Account
    - ACCOUNT_CREATED
    - ACCOUNT_UPDATED
    - ACCOUNT_DELETED
    # Group
    - GROUP_CREATED
    - GROUP_UPDATED
    - GROUP_DELETED
    # File
    - FILE_CREATED
    - FILE_UPDATED
    # Query
    - QUERY_CREATED
    - QUERY_UPDATED
    - QUERY_DELETED
    # Comment
    - COMMENT_CREATED
    - COMMENT_DELETED
    # Collaborator
    - COLLABORATOR_ADDED
    - COLLABORATOR_UPDATED
    - COLLABORATOR_REMOVED
    # Integration
    - INTEGRATION_CREATED
    - INTEGRATION_UPDATED
    - INTEGRATION_DELETED
    # Book
    - BOOK_CREATED
    - BOOK_UPDATED
    - BOOK_DELETED
    - BOOK_AUDITED

# -----------------------------------------------------------------------------
# FILE PATTERNS (optional)
# -----------------------------------------------------------------------------
# For file processing apps. When a file matching these patterns is uploaded,
# a FILE_CREATED event is triggered with the file content.
filePatterns:
    - '*.ofx'
    - '*.csv'

# -----------------------------------------------------------------------------
# PROPERTIES SCHEMA (optional)
# -----------------------------------------------------------------------------
# Defines autocomplete suggestions for custom properties in the Bkper UI.
# Helps users discover and use the correct property keys/values for your app.
propertiesSchema:
    book:
        keys:
            - my_app_enabled
            - my_app_config
        values:
            - 'true'
            - 'false'
    group:
        keys:
            - my_app_category
        values:
            - category_a
            - category_b
    account:
        keys:
            - my_app_sync_id
    transaction:
        keys:
            - my_app_reference

# -----------------------------------------------------------------------------
# DEPLOYMENT CONFIGURATION (optional)
# -----------------------------------------------------------------------------
# For apps deployed to Bkper's Workers for Platforms infrastructure.
deployment:
    # Single server Worker entry point. It serves /api/* and /events.
    server: server/src/index.ts

    # Optional Vite/static client root. Built assets are deployed with the same Worker.
    client: client

    # Platform services available to your app (one per type, auto-provisioned)
    # See: https://developers.cloudflare.com/kv/
    services:
        - KV # Key-value storage

    # Secret names managed with bkper app secrets
    secrets:
        - EXTERNAL_SERVICE_TOKEN

    # Cloudflare Workers compatibility date
    compatibility_date: '2026-01-28'
```

</details>

**Environment variables:**

-   `BKPER_API_KEY` -- Optional. If not set, uses the Bkper API proxy with a managed API key. Set it for direct API access with your own quotas. Follow [these steps](https://bkper.com/docs/#rest-api-enabling) to enable.

---

## Command Reference

### Authentication

-   `auth login` - Connect the CLI to your Bkper account, storing credentials locally
-   `auth logout` - Revoke the stored Bkper refresh token and clear local credentials
-   `auth token` - Print the current Bkper OAuth access token to stdout (requires prior login)

### Agent

-   `bkper` - Start the interactive Bkper Agent when run in an interactive terminal; print CLI help in non-interactive contexts
-   `agent` - Start the interactive Bkper Agent
-   `agent <pi-args...>` - Run Pi CLI with Bkper defaults (system prompt/resources)

Inside the interactive agent, `/login` connects an AI model provider; it is separate from `bkper auth login`, which connects the CLI to your Bkper account.

### App Lifecycle

-   `app init <name>` - Scaffold a new app from the template
-   `app list` - List all apps you have access to
-   `app sync` - Sync [bkper.yaml][bkper.yaml reference] configuration (URLs, description) to Bkper API
-   `app build` - Build the server Worker bundle for deployment
-   `app deploy` - Deploy built artifacts to Cloudflare Workers for Platforms
    -   `-p, --preview` - Deploy to preview environment
-   `app status` - Show deployment status
-   `app logs [appId]` - View recent app logs. When `appId` is omitted, the app id is read from local app config.
    -   `--since <time>` - ISO8601 or relative lower bound (e.g. `5m`, `1h`, `15d`)
    -   `--until <time>` - ISO8601 or relative upper bound
    -   `--last <n>` - Show newest N requests after filters (default: 100)
    -   `-p, --preview` - Query preview logs instead of production
    -   `-w, --web` - Filter to normal web/API requests
    -   `-e, --events` - Filter to `/events` requests
    -   `--level <level>` - Minimum log level threshold (`info`, `warn`, or `error`)
    -   `--status-code <code>` - Filter by HTTP status code
-   `app undeploy` - Remove app from platform
    -   `-p, --preview` - Remove from preview environment
    -   `--delete-data` - Permanently delete all associated data (requires confirmation)
    -   `--force` - Skip confirmation prompts (use with `--delete-data` for automation)
-   `app dev` - Start the worker runtime for local development
    -   `--sp, --server-port <port>` - Server simulation port (default: `8787`)

> **Note:** `sync` and `deploy` are independent operations. Use `sync` to update your app's URLs in Bkper (required for webhooks and menu integration). Use `deploy` to push code to Cloudflare. For a typical deployment workflow, run both: `bkper app sync && bkper app deploy`

### App Installation

-   `app install <appId> -b <bookId>` - Install an app on a book
-   `app uninstall <appId> -b <bookId>` - Uninstall an app from a book

### Secrets Management

-   `app secrets put <name>` - Store a secret
    -   `-p, --preview` - Set in preview environment
-   `app secrets list` - List all secrets
    -   `-p, --preview` - List from preview environment
-   `app secrets delete <name>` - Delete a secret
    -   `-p, --preview` - Delete from preview environment
