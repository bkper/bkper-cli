[Bkper REST API]: https://bkper.com/docs/#rest-api-enabling

A **command line** utility for managing [Bkper Apps](https://bkper.com/docs/) and running the [Model Context Protocol (MCP) server](https://modelcontextprotocol.io).

The CLI provides atomic operations for app deployment and management, designed to work seamlessly with AI coding agents (Claude Code, OpenCode) that orchestrate the development workflow.

[![npm](https://img.shields.io/npm/v/bkper?color=%235889e4)](https://www.npmjs.com/package/bkper)

## Installation

### npm

```
npm i -g bkper
```

### yarn

```
yarn global add bkper
```

### bun (recommended)

```
bun add -g bkper
```

## Development Model

Bkper apps are developed with AI coding agents as the primary interface. The CLI provides **atomic, composable operations** that agents orchestrate:

- **Typical developers**: Work with AI agents (Claude Code, OpenCode) that handle build, watch, and deploy decisions
- **Advanced developers**: Use CLI directly with the same atomic commands

The CLI focuses on **platform operations** (deploy, sync, secrets) while build and development workflows are handled by standard tools (`bun run build`, `bun run dev`) orchestrated by agents or developers directly.

## Commands

### Authentication

- `login` - Authenticate with Bkper, storing credentials locally
- `logout` - Remove stored credentials

### App Management

- `apps init <name>` - Scaffold a new app from the template
- `apps list` - List all apps you have access to
- `apps sync` - Sync `bkperapp.yaml` configuration to the platform
- `apps deploy` - Deploy built artifacts to the platform
  - `--dev` - Deploy to development environment
  - `--web` - Deploy web handler only
  - `--events` - Deploy events handler only
- `apps status` - Show deployment status
- `apps undeploy` - Remove app from platform
  - `--dev` - Remove from development environment
  - `--web` - Remove web handler only
  - `--events` - Remove events handler only

### Secrets Management

- `apps secrets put <name>` - Store a secret
- `apps secrets list` - List all secrets
- `apps secrets delete <name>` - Delete a secret

### MCP Server

- `mcp start` - Start the Model Context Protocol server

### Examples

```bash
# Authenticate
bkper login

# Create a new app
bkper apps init my-app

# Deploy to production (run from app directory)
bkper apps deploy

# Deploy to development environment
bkper apps deploy --dev

# Deploy only the events handler to dev
bkper apps deploy --dev --events

# Check deployment status
bkper apps status

# Manage secrets
bkper apps secrets put API_KEY
bkper apps secrets list
```

## MCP (Model Context Protocol) Server

Bkper includes an MCP server that allows AI assistants and other tools to interact with your Bkper books through the [Model Context Protocol](https://modelcontextprotocol.io).

### Starting the MCP Server

```bash
bkper mcp start
```

The server runs on stdio and provides the following tools:

- **list_books** - List all books accessible by the authenticated user
- **get_book** - Get detailed information about a specific book
- **get_balances** - Get account balances with query filtering
- **list_transactions** - List transactions with filtering and pagination
- **create_transactions** - Create transactions in batch
- **merge_transactions** - Merge duplicate transactions into one

### Prerequisites

Before using the MCP server:

1. Login using `bkper login` to set up authentication

The MCP server uses the same authentication as the CLI, reading credentials from `~/.config/bkper/.bkper-credentials.json`.

### Integration Examples

#### Claude Desktop

Add to your configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
    "mcpServers": {
        "bkper": {
            "command": "bkper",
            "args": ["mcp", "start"]
        }
    }
}
```

#### Other MCP Clients

For other MCP-compatible clients, configure them to run:

```bash
bkper mcp start
```

The server communicates via stdio, so any MCP client that supports stdio transport can connect to it.

## Apps Configuration

Apps are configured via a `bkperapp.yaml` file in the project root.

### Environment Variables

`BKPER_API_KEY` is optional. If not set, uses the Bkper API proxy with a managed API key.

Set it for direct API access with your own quotas and attribution. Follow [these](https://bkper.com/docs/#rest-api-enabling) steps.

### `bkperapp.yaml` Reference

```yaml
# APP IDENTITY (id cannot be changed after creation)
id: my-app
name: My App
description: A Bkper app that does something useful

# BRANDING
logoUrl: https://example.com/logo.svg
logoUrlDark: https://example.com/logo-dark.svg
website: https://example.com

# OWNERSHIP
ownerName: Your Name
ownerWebsite: https://yoursite.com
repoUrl: https://github.com/you/my-app
repoPrivate: true

# ACCESS CONTROL (usernames, not emails)
# Supports domain wildcards for registered custom domains
developers: victor, aldo, *@bkper.com
users: maria, *@acme.com

# MENU INTEGRATION (optional)
# Opens in popup when user clicks app in Bkper menu
menuUrl: https://${id}.bkper.app?bookId=${book.id}
menuUrlDev: http://localhost:8787?bookId=${book.id}
menuText: Open My App
menuPopupWidth: 500
menuPopupHeight: 300

# EVENT HANDLING (optional)
# Webhook called when Bkper events occur
webhookUrl: https://${id}.bkper.app/events
webhookUrlDev: https://${id}-dev.bkper.app/events
apiVersion: v5
events:
    - TRANSACTION_POSTED
    - TRANSACTION_CHECKED
    - TRANSACTION_UNCHECKED
    - TRANSACTION_UPDATED
    - TRANSACTION_DELETED
    - TRANSACTION_RESTORED
    - ACCOUNT_CREATED
    - ACCOUNT_UPDATED
    - ACCOUNT_DELETED
    - GROUP_CREATED
    - GROUP_UPDATED
    - GROUP_DELETED
    - FILE_CREATED
    - BOOK_UPDATED

# FILE PATTERNS (for file processing bots)
filePatterns:
    - "*.ofx"
    - "*.csv"

# DEPLOYMENT CONFIGURATION
deployment:
  web:
    bundle: packages/web/server/dist
  events:
    bundle: packages/events/dist
  bindings:
    - KV

# Schema to provide autocompletion on properties editor.
propertiesSchema:
    book:
        keys:
            - "key1"
            - "key2"
        values:
            - "value2"
            - "value2"
    group:
        keys:
            - "key1"
            - "key2"
        values:
            - "value2"
            - "value2"
    account:
        keys:
            - "key1"
            - "key2"
        values:
            - "value2"
            - "value2"
    transaction:
        keys:
            - "key1"
            - "key2"
        values:
            - "value2"
            - "value2"
```

### Menu URL Variables

| Variable                   | Description                |
| -------------------------- | -------------------------- |
| `${book.id}`               | Current book ID            |
| `${book.properties.xxx}`   | Book property value        |
| `${account.id}`            | Current account ID         |
| `${account.properties.xxx}`| Account property value     |
| `${group.id}`              | Current group ID           |
| `${group.properties.xxx}`  | Group property value       |
| `${transactions.ids}`      | Selected transaction IDs   |
| `${transactions.query}`    | Current query              |

## Developer Tooling (Skills)

The CLI automatically syncs AI agent skills from the [skills repository](https://github.com/bkper/skills). Skills provide procedural knowledge to AI coding assistants (Claude Code, OpenCode) when working on Bkper apps.

Skills are synced when running:
- `bkper apps init <name>` - when creating a new app
- `bkper mcp start` - when starting the MCP server

## Library

The `getOAuthToken` function returns a Promise that resolves to a valid OAuth token, for use with the [`bkper-js`](https://github.com/bkper/bkper-js) library:

```javascript
import { Bkper } from "bkper-js";
import { getOAuthToken } from "bkper";

Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
});
```

## Documentation

- [Developer Docs](https://bkper.com/docs)
- [App Template](https://github.com/bkper/bkper-app-template)
- [Skills Repository](https://github.com/bkper/skills)
