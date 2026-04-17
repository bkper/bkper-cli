[Developer Docs]: https://bkper.com/docs
[App Template]: https://github.com/bkper/bkper-app-template
[Pi]: https://pi.dev/

A unified **interface for [Bkper](https://bkper.com)**. Use `bkper` in two complementary modes:

-   **Interactive mode** — run `bkper agent` to open the Bkper Agent TUI
-   **Command mode** — run `bkper <command>` for explicit CLI workflows, scripts, and automation

With one tool, you can build and deploy Bkper apps, and manage financial data -- books, accounts, transactions, and balances.

[![npm](https://img.shields.io/npm/v/bkper?color=%235889e4)](https://www.npmjs.com/package/bkper)

## Quick Start

### Prerequisites

-   [Node.js](https://nodejs.org/) >= 18

### Install (choose one)

```bash tab="bun"
bun add -g bkper
```

```bash tab="npm"
npm i -g bkper
```

```bash tab="pnpm"
pnpm add -g bkper
```

```bash tab="yarn"
yarn global add bkper
```

### Authenticate

```bash
bkper auth login
```

This is the only command that opens the browser OAuth flow.

Other commands:

-   use stored credentials when available
-   otherwise return an authentication error instead of starting login automatically
-   can also work behind an external proxy that injects auth headers

When you are done working in a sandbox, run `bkper auth logout` to revoke the stored refresh token and clear local credentials.

### Start using bkper

```bash
# Show CLI help
bkper
```

```bash
# Interactive mode (agent TUI)
bkper agent
```

```bash
# Command mode (explicit command)
bkper book list
```

Pick a book and create your first transaction:

```bash
bkper transaction create -b <bookId> --description "Office supplies 123.78"
```

> Run `bkper --help` or `bkper <command> --help` for built-in documentation on any command.

### Access Token

Use the access token for direct API calls from any tool.
This requires a prior `bkper auth login`, and `bkper auth token` does not start a browser login flow:

```bash
# Print the current access token
TOKEN=$(bkper auth token)

# Use it with curl, httpie, or any HTTP client
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.bkper.app/v5/books | jq '.items[].name'
```

---

## Interactive Mode (powered by Pi)

Run `bkper agent` to start the embedded Bkper Agent TUI. Running `bkper` with no arguments shows CLI help.

Bkper's agent mode is intentionally a **thin wrapper** around [Pi][Pi]:

-   Pi provides the core agent runtime and TUI
-   bkper adds Bkper-specific domain context and startup maintenance behavior

### Startup maintenance (non-blocking)

On each agent startup, bkper performs a background CLI auto-update check (same behavior as command mode).

### Pi passthrough

Use Pi CLI features directly through bkper:

```bash
bkper agent <pi-args>
```

If no Pi arguments are provided, `bkper agent` starts the interactive Bkper Agent experience.
If Pi arguments are provided, everything after `bkper agent` is passed through to Pi.

Examples:

```bash
bkper agent -p "Summarize this repository"
bkper agent --model openai/gpt-4o -c
bkper agent install <pi-package-source>
bkper agent --help
```

`bkper agent` keeps Bkper defaults (including the Bkper system prompt) unless you explicitly pass `--system-prompt`.
Use `bkper help agent` for the Bkper CLI command help, and `bkper agent --help` for Pi help.

For all available passthrough flags and commands, see the Pi CLI reference:
https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#cli-reference

Pi-specific extensions are loaded from Pi extension folders (for example `.pi/extensions` and `~/.pi/agent/extensions`).

---

## Data Management

Manage books, accounts, transactions, and balances.

```bash
bkper book list
bkper account list -b <bookId>
bkper transaction list -b <bookId> -q 'on:2025' --format csv
bkper balance list -b <bookId> -q 'on:2025-12-31' --format csv
```

→ [Full Data Management reference](https://github.com/bkper/bkper-cli/blob/main/docs/data-management.md)


---

## App Management

Build, deploy, and manage Bkper apps.

```bash
bkper app init my-app
bkper app dev
bkper app sync && bkper app deploy
```

→ [Full App Management reference](https://github.com/bkper/bkper-cli/blob/main/docs/app-management.md)

---

## Library

The `getOAuthToken` function returns a Promise that resolves to a valid OAuth token, for use with the [`bkper-js`](https://github.com/bkper/bkper-js) library:

```javascript
import { Bkper } from 'bkper-js';
import { getOAuthToken } from 'bkper';

Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
});
```
