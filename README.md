[Developer Docs]: https://bkper.com/docs
[App Template]: https://github.com/bkper/bkper-app-template
[Pi]: https://pi.dev/

A unified **interface for [Bkper](https://bkper.com)**. Use `bkper` in two complementary modes:

-   **Interactive mode** — run `bkper` or `bkper agent` to open the Bkper Agent TUI
-   **Command mode** — run `bkper <command>` for explicit CLI workflows, scripts, and automation

With one tool, you can build and deploy Bkper apps, and manage financial data -- books, accounts, transactions, and balances.

[![npm](https://img.shields.io/npm/v/bkper?color=%235889e4)](https://www.npmjs.com/package/bkper)

## Install & Authenticate

### Prerequisites

-   [Node.js](https://nodejs.org/) >= 22

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

This prints a Google verification URL and one-time code. Open the URL in any browser, enter the code, and the CLI stores credentials locally. When you are done working, run `bkper auth logout` to clear local credentials.

---

## Get started

### Interactive mode (recommended)

```bash
bkper
```

`bkper agent` starts the same interactive experience. Bare `bkper` only opens the TUI in an interactive terminal; in non-interactive contexts it prints CLI help instead.

![Bkper CLI Agent TUI](https://raw.githubusercontent.com/bkper/bkper-cli/main/assets/bkper-agent-cli.png)

On first launch, type `/login` and select a provider. We recommend [OpenCode Go](https://opencode.ai/go) for open-weights models and [OpenCode Zen](https://opencode.ai/zen) for frontier models — both give you access to high-quality models with no extra setup.

Good starting prompts:

- `What are the main account types in Bkper?`
- `How do I query transactions using the CLI?`
- `What files are in this project?`
- `Help me create a script that lists all accounts in my book`

→ See [Interactive Mode](#interactive-mode-powered-by-pi) below for passthrough flags and advanced usage.

### Command mode

```bash
# List your books
bkper book list

# Show CLI help
bkper --help
```

Pick a book and create your first transaction:

```bash
bkper transaction create -b <bookId> --description "Office supplies 123.78"
```

> Run `bkper --help` or `bkper <command> --help` for built-in documentation on any command.

→ See [Data Management](#data-management) and [App Management](#app-management) below for full command references.

---

## Interactive Mode (powered by Pi)

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
A bare `bkper` command is a convenience shortcut for the same TUI when run in an interactive terminal.
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

Manage books, files, accounts, transactions, and balances.

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
bkper app logs --last 50
bkper app logs my-app --level error
```

`bkper app logs` reads recent app logs kept for 15 days. Run it inside an app directory, or pass an app id like `bkper app logs my-app`. Use `--level warn` or `--level error` to focus on requests with warnings or errors. The default output is human-readable, and JSON is available with `--json`.

→ [Full App Management reference](https://github.com/bkper/bkper-cli/blob/main/docs/app-management.md)

---

## Programmatic access

### Access Token

Use the access token for direct API calls from any tool.
This requires a prior `bkper auth login`, and `bkper auth token` does not start an interactive login flow:

```bash
# Print the current access token
TOKEN=$(bkper auth token)

# Use it with curl, httpie, or any HTTP client
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.bkper.app/v5/books | jq '.items[].name'
```

### Library

The `getOAuthToken` function returns a Promise that resolves to a valid OAuth token, for use with the [`bkper-js`](https://github.com/bkper/bkper-js) library:

```javascript
import { Bkper } from 'bkper-js';
import { getOAuthToken } from 'bkper';

Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
});
```

---

## Next steps

-   [Developer Docs][Developer Docs] — full platform documentation
-   [App Template][App Template] — scaffold a Bkper app in minutes
-   [Full CLI reference](https://github.com/bkper/bkper-cli/tree/main/docs) — data management, app building, taxes, and financial statements
