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

- `app init <name>` - Scaffold a new app from the template
- `app list` - List all apps you have access to
- `app sync` - Sync `bkper.yaml` configuration to the platform
- `app deploy` - Deploy built artifacts to the platform
  - `--dev` - Deploy to development environment
  - `--web` - Deploy web handler only
  - `--events` - Deploy events handler only
- `app status` - Show deployment status
- `app undeploy` - Remove app from platform
  - `--dev` - Remove from development environment
  - `--web` - Remove web handler only
  - `--events` - Remove events handler only

### Secrets Management

- `app secrets put <name>` - Store a secret
- `app secrets list` - List all secrets
- `app secrets delete <name>` - Delete a secret

### MCP Server

- `mcp start` - Start the Model Context Protocol server

### Examples

```bash
# Authenticate
bkper login

# Create a new app
bkper app init my-app

# Deploy to production (run from app directory)
bkper app deploy

# Deploy to development environment
bkper app deploy --dev

# Deploy only the events handler to dev
bkper app deploy --dev --events

# Check deployment status
bkper app status

# Manage secrets
bkper app secrets put API_KEY
bkper app secrets list
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

Apps are configured via a `bkper.yaml` file in the project root.

### Environment Variables

`BKPER_API_KEY` is optional. If not set, uses the Bkper API proxy with a managed API key.

Set it for direct API access with your own quotas and attribution. Follow [these](https://bkper.com/docs/#rest-api-enabling) steps.

### `bkper.yaml` Reference

See the complete reference with all available fields and documentation:

**[docs/bkper-reference.yaml](https://raw.githubusercontent.com/bkper/bkper-cli/main/docs/bkper-reference.yaml)**

## Developer Tooling (Skills)

The CLI automatically syncs AI agent skills from the [skills repository](https://github.com/bkper/skills). Skills provide procedural knowledge to AI coding assistants (Claude Code, OpenCode) when working on Bkper apps.

Skills are synced when running:
- `bkper app init <name>` - when creating a new app
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
