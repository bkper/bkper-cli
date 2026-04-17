[bkper.yaml reference]: #bkperyaml-reference
[App Template]: https://github.com/bkper/bkper-app-template

# App Management

Build, deploy, and manage Bkper apps using the `bkper` CLI.

---

## Development Workflow

```bash
# Scaffold a new app from the template
bkper app init my-app

# Start the worker runtime (Miniflare + tunnel + file watching)
# In your project, use "npm run dev" to run both Vite and workers concurrently
bkper app dev

# Build worker bundles (web server + events handler)
# In your project, use "npm run build" to build both client (Vite) and workers
bkper app build

# Sync configuration and deploy to production
bkper app sync && bkper app deploy

# Deploy to development environment
bkper app deploy --preview

# Deploy only the events handler
bkper app deploy --events

# Check deployment status
bkper app status
```

> **Note:** `bkper app dev` runs the worker runtime only — Miniflare, file watching, and the Cloudflare tunnel. The Vite client dev server is configured in the project's `vite.config.ts` and run separately. The project template composes both via `npm run dev` using `concurrently`.

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
bkper app secrets put API_KEY

# List all secrets
bkper app secrets list

# Delete a secret
bkper app secrets delete API_KEY
```

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
    # Web handler (serves UI and API)
    web:
        bundle: packages/web/server/dist
        # assets: packages/web/client/dist  # Static assets (when supported)

    # Events handler (processes webhooks)
    events:
        bundle: packages/events/dist

    # Platform services available to your app (one per type, auto-provisioned)
    # See: https://developers.cloudflare.com/kv/
    services:
        - KV # Key-value storage
```

</details>

**Environment variables:**

-   `BKPER_API_KEY` -- Optional. If not set, uses the Bkper API proxy with a managed API key. Set it for direct API access with your own quotas. Follow [these steps](https://bkper.com/docs/#rest-api-enabling) to enable.

---

## Command Reference

### Authentication

-   `auth login` - Authenticate with Bkper, storing credentials locally
-   `auth logout` - Revoke the stored refresh token and clear local credentials
-   `auth token` - Print the current OAuth access token to stdout (requires prior login)

### Agent

-   `agent` - Start the interactive Bkper Agent
-   `agent <pi-args...>` - Run Pi CLI with Bkper defaults (system prompt/resources)

### App Lifecycle

-   `app init <name>` - Scaffold a new app from the template
-   `app list` - List all apps you have access to
-   `app sync` - Sync [bkper.yaml][bkper.yaml reference] configuration (URLs, description) to Bkper API
-   `app build` - Build worker bundles for deployment
-   `app deploy` - Deploy built artifacts to Cloudflare Workers for Platforms
    -   `-p, --preview` - Deploy to preview environment
    -   `--events` - Deploy events handler instead of web handler
-   `app status` - Show deployment status
-   `app undeploy` - Remove app from platform
    -   `-p, --preview` - Remove from preview environment
    -   `--events` - Remove events handler instead of web handler
    -   `--delete-data` - Permanently delete all associated data (requires confirmation)
    -   `--force` - Skip confirmation prompts (use with `--delete-data` for automation)
-   `app dev` - Start the worker runtime for local development
    -   `--sp, --server-port <port>` - Server simulation port (default: `8787`)
    -   `--ep, --events-port <port>` - Events handler port (default: `8791`)
    -   `-w, --web` - Run only the web handler
    -   `-e, --events` - Run only the events handler

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
