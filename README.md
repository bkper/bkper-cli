[Bkper REST API]: https://bkper.com/docs/#rest-api-enabling

A **command line** utility for managing [Bkper Apps](https://bkper.com/docs/) and interacting with Bkper data.

The CLI provides atomic operations for app deployment and management, plus data commands for books, accounts, groups, transactions, and balances. Designed to work seamlessly with AI coding agents (Claude Code, OpenCode) that orchestrate the development workflow.

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

-   **Typical developers**: Work with AI agents (Claude Code, OpenCode) that handle build, watch, and deploy decisions
-   **Advanced developers**: Use CLI directly with the same atomic commands

The CLI focuses on **platform operations** (deploy, sync, secrets) while build and development workflows are handled by standard tools (`bun run build`, `bun run dev`) orchestrated by agents or developers directly.

## Commands

### Authentication

-   `login` - Authenticate with Bkper, storing credentials locally
-   `logout` - Remove stored credentials

### App Management

-   `app init <name>` - Scaffold a new app from the template
-   `app list` - List all apps you have access to
-   `app sync` - Sync `bkper.yaml` configuration (URLs, description) to Bkper API
-   `app deploy` - Deploy built artifacts to Cloudflare Workers for Platforms
    -   `--dev` - Deploy to development environment
    -   `--events` - Deploy events handler instead of web handler
-   `app status` - Show deployment status
-   `app undeploy` - Remove app from platform
    -   `--dev` - Remove from development environment
    -   `--events` - Remove events handler instead of web handler
    -   `--delete-data` - Permanently delete all associated data (requires confirmation)
    -   `--force` - Skip confirmation prompts (use with `--delete-data` for automation)
-   `app dev` - Run local development servers
    -   `--cp, --client-port <port>` - Client dev server port (default: `5173`)
    -   `--sp, --server-port <port>` - Server simulation port (default: `8787`)
    -   `--ep, --events-port <port>` - Events handler port (default: `8791`)
    -   `-w, --web` - Run only the web handler
    -   `-e, --events` - Run only the events handler
-   `app build` - Build app artifacts
-   `app install <appId> -b <bookId>` - Install an app on a book
-   `app uninstall <appId> -b <bookId>` - Uninstall an app from a book

> **Note:** `sync` and `deploy` are independent operations. Use `sync` to update your app's URLs
> in Bkper (required for webhooks and menu integration). Use `deploy` to push code to Cloudflare.
> For a typical deployment workflow, run both: `bkper app sync && bkper app deploy`

### Secrets Management

-   `app secrets put <name>` - Store a secret
-   `app secrets list` - List all secrets
-   `app secrets delete <name>` - Delete a secret

### Data Commands

All data commands that operate within a book use `-b, --book <bookId>` to specify the book context.

#### Books

-   `book list` - List all books
    -   `-q, --query <query>` - Search query
-   `book get <bookId>` - Get a book's details
-   `book create` - Create a new book
    -   `--name <name>` - Book name (required)
    -   `--fraction-digits <digits>` - Number of decimal places (`0`-`8`)
    -   `--date-pattern <pattern>` - Date format pattern (`dd/MM/yyyy`, `MM/dd/yyyy`, or `yyyy/MM/dd`)
    -   `--decimal-separator <separator>` - Decimal separator (`DOT` or `COMMA`)
    -   `--time-zone <timezone>` - IANA time zone (e.g. `America/New_York`, `UTC`)
    -   `--period <period>` - Period (`MONTH`, `QUARTER`, or `YEAR`)
    -   `-p, --property <key=value>` - Set a property (repeatable)
-   `book update <bookId>` - Update a book
    -   `--name <name>` - Book name
    -   `--fraction-digits <digits>` - Number of decimal places (`0`-`8`)
    -   `--date-pattern <pattern>` - Date format pattern (`dd/MM/yyyy`, `MM/dd/yyyy`, or `yyyy/MM/dd`)
    -   `--decimal-separator <separator>` - Decimal separator (`DOT` or `COMMA`)
    -   `--time-zone <timezone>` - IANA time zone identifier (e.g. `America/New_York`, `Europe/London`, `UTC`)
    -   `--lock-date <date>` - Lock date in ISO format (`yyyy-MM-dd`, e.g. `2024-01-31`)
    -   `--closing-date <date>` - Closing date in ISO format (`yyyy-MM-dd`)
    -   `--period <period>` - Period (`MONTH`, `QUARTER`, or `YEAR`)
    -   `-p, --property <key=value>` - Set a property (repeatable, e.g. `-p code=1010 -p branch=NYC`; empty value deletes the property)

#### Accounts

-   `account list -b <bookId>` - List accounts in a book
-   `account get <nameOrId> -b <bookId>` - Get an account
-   `account create -b <bookId>` - Create a new account
    -   `--name <name>` - Account name (required)
    -   `--type <type>` - Account type (`ASSET`, `LIABILITY`, `INCOMING`, `OUTGOING`)
    -   `--description <description>` - Account description
    -   `--groups <groups>` - Comma-separated group names
    -   `-p, --property <key=value>` - Set a property (repeatable)
-   `account update <nameOrId> -b <bookId>` - Update an account
    -   `--name <name>` - Account name
    -   `--type <type>` - Account type (`ASSET`, `LIABILITY`, `INCOMING`, `OUTGOING`)
    -   `--archived <true|false>` - Archive status
    -   `-p, --property <key=value>` - Set a property (repeatable, merges with existing)
-   `account delete <nameOrId> -b <bookId>` - Delete an account

#### Groups

-   `group list -b <bookId>` - List groups in a book
-   `group get <nameOrId> -b <bookId>` - Get a group
-   `group create -b <bookId>` - Create a new group
    -   `--name <name>` - Group name (required)
    -   `--parent <parent>` - Parent group name or ID
    -   `--hidden` - Hide the group
    -   `-p, --property <key=value>` - Set a property (repeatable)
-   `group update <nameOrId> -b <bookId>` - Update a group
    -   `--name <name>` - Group name
    -   `--hidden <true|false>` - Hide status
    -   `-p, --property <key=value>` - Set a property (repeatable, merges with existing)
-   `group delete <nameOrId> -b <bookId>` - Delete a group

#### Transactions

-   `transaction list -b <bookId> -q <query>` - List transactions matching a query
    -   `-l, --limit <limit>` - Maximum number of results (`1`-`1000`, default `100`)
    -   `-c, --cursor <cursor>` - Pagination cursor
    -   `-p, --properties` - Include custom properties in the output
-   `transaction create -b <bookId>` - Create a transaction
    -   `--date <date>` - Transaction date (required)
    -   `--amount <amount>` - Transaction amount (required)
    -   `--description <description>` - Transaction description
    -   `--from <from>` - Credit account (source)
    -   `--to <to>` - Debit account (destination)
    -   `--url <url>` - URL (repeatable)
    -   `--remote-id <remoteId>` - Remote ID (repeatable)
    -   `-p, --property <key=value>` - Set a property (repeatable, empty value deletes)
-   `transaction update <transactionId> -b <bookId>` - Update a transaction
    -   `--date <date>` - Transaction date
    -   `--amount <amount>` - Transaction amount
    -   `--description <description>` - Transaction description
    -   `--from <from>` - Credit account (source)
    -   `--to <to>` - Debit account (destination)
    -   `--url <url>` - URL (repeatable, replaces all)
    -   `-p, --property <key=value>` - Set a property (repeatable, empty value deletes)
-   `transaction post <id> -b <bookId>` - Post a draft transaction
-   `transaction check <id> -b <bookId>` - Check a transaction
-   `transaction trash <id> -b <bookId>` - Trash a transaction
-   `transaction merge <id1> <id2> -b <bookId>` - Merge two transactions

#### Balances

-   `balance list -b <bookId> -q <query>` - List balances
    -   `--expanded <level>` - Expand groups to specified depth (`0`+)

#### Collections

-   `collection list` - List all collections
-   `collection get <collectionId>` - Get a collection
-   `collection create` - Create a new collection
    -   `--name <name>` - Collection name (required)
-   `collection update <collectionId>` - Update a collection
    -   `--name <name>` - Collection name
-   `collection delete <collectionId>` - Delete a collection
-   `collection add-book <collectionId>` - Add books to a collection
    -   `-b, --book <bookId>` - Book ID (repeatable)
-   `collection remove-book <collectionId>` - Remove books from a collection
    -   `-b, --book <bookId>` - Book ID (repeatable)

### Output Format

All commands output human-readable formatted tables by default. Use the `--json` global flag to get raw JSON output instead.

```bash
# Table output (default)
bkper book list

# JSON output
bkper book list --json

# List accounts in a book
bkper account list -b abc123

# List transactions with properties
bkper transaction list -b abc123 -q "after:2025-01-01" -p
```

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

# Install/uninstall apps
bkper app install my-app -b abc123
bkper app uninstall my-app -b abc123

# Create a transaction
bkper transaction create -b abc123 --date 2025-01-15 --amount 100.50 --from "Bank Account" --to "Office Supplies" --description "Printer paper"

# Update a transaction
bkper transaction update tx_456 -b abc123 --amount 120.00 --description "Printer paper (corrected)"

# Create a new book with Brazilian settings
bkper book create --name "My Company" --fraction-digits 2 --date-pattern "dd/MM/yyyy" --decimal-separator COMMA --time-zone "America/Sao_Paulo"

# Create a book with custom properties
bkper book create --name "Project X" -p "code=PX001" -p "department=Engineering"

# Create and manage collections
bkper collection create --name "My Collection"
bkper collection add-book col_789 -b abc123 -b def456
bkper collection list
```

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

-   `bkper app init <name>` - when creating a new app

## Library

The `getOAuthToken` function returns a Promise that resolves to a valid OAuth token, for use with the [`bkper-js`](https://github.com/bkper/bkper-js) library:

```javascript
import { Bkper } from 'bkper-js';
import { getOAuthToken } from 'bkper';

Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
});
```

## Documentation

-   [Developer Docs](https://bkper.com/docs)
-   [App Template](https://github.com/bkper/bkper-app-template)
-   [Skills Repository](https://github.com/bkper/skills)
