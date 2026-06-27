[Developer Docs]: https://bkper.com/docs
[App Template]: https://github.com/bkper/bkper-app-template
[Pi]: https://pi.dev/

A unified **interface for [Bkper](https://bkper.com)**. Use `bkper` in two complementary modes:

-   **Interactive mode** — run `bkper` or `bkper agent` to open the Bkper Agent TUI
-   **Command mode** — run `bkper <command>` for explicit CLI workflows, scripts, and automation

With one tool, you can work with Bkper from your terminal, built-in agent, or external AI tools — managing financial data, building apps, and automating workflows.

[![npm](https://img.shields.io/npm/v/bkper?color=%235889e4)](https://www.npmjs.com/package/bkper)

## Install & Authenticate

### Prerequisites

-   [Node.js](https://nodejs.org/) >= 22.19.0

### Install (choose one)

```bash tab="npm"
npm i -g bkper
```

```bash tab="bun"
bun add -g bkper
```

```bash tab="pnpm"
pnpm add -g bkper
```

```bash tab="yarn"
yarn global add bkper
```

### Authenticate with Bkper

```bash
bkper auth login
```

`bkper auth login` connects the CLI to your Bkper account. The same local authentication can be used by direct CLI commands, the built-in agent, external coding agents, scripts, and local app development.

---

## Get started

### Interactive mode (recommended)

```bash
bkper
```

`bkper agent` starts the same interactive experience. Bare `bkper` only opens the TUI in an interactive terminal; in non-interactive contexts it prints CLI help instead.

![Bkper CLI Agent TUI](https://raw.githubusercontent.com/bkper/bkper-cli/main/assets/bkper-agent-cli.png)

On first agent launch, type `/login` in the TUI if model access is not configured yet. `bkper auth login` connects the CLI to your Bkper account. `/login` connects the interactive agent to an AI/model provider.

For frontier models, a standard ChatGPT Plus/Pro subscription with Codex is a practical starting point. For open-weights models, [OpenCode Go](https://opencode.ai/go) is a great option.

Safe starting prompts:

```text
Show me a balance sheet as of today. Use Bkper balance queries, not manual calculations.
```

```text
Show me profit and loss for last month using this book's reporting groups.
```

```text
Find possible duplicate transactions from last month. Just show me what you find. Don't change anything yet.
```

```text
Review unchecked transactions from this month and suggest what needs attention. Don't update, post, or check anything yet.
```

```text
Prepare an exploratory tax worksheet for 2025. Ask me to confirm tax groups and accounts first.
```

```text
Before making any change in Bkper, explain the exact plan and ask for my confirmation.
```

### Command mode

Use direct commands for scripts, exports, automation, and repeatable workflows.

```bash
# List your books
bkper book list

# Query transactions
bkper transaction list -b <bookId> -q 'on:2026-06' --format csv

# Query balances
bkper balance list -b <bookId> -q 'on:2026-06-30'
```

Capture a receipt as a draft, then review and complete it in Bkper or with the agent:

```bash
bkper transaction create -b <bookId> --file ./receipt.pdf
```

> Run `bkper --help` or `bkper <command> --help` for built-in documentation on any command.

→ See [Data Management](#data-management) and [App Management](#app-management) below for full references.

---

## Use Bkper from your existing agent

Install and authenticate the CLI first:

```bash
bkper auth login
```

For Codex, add this repository as a plugin marketplace, then install the `bkper-cli` plugin from Codex's plugin directory:

```bash
codex plugin marketplace add bkper/bkper-cli
```

For Claude Code, install the Bkper CLI plugin from this repository's Claude marketplace:

```text
/plugin marketplace add bkper/bkper-cli
/plugin install bkper-cli@bkper
```

For other coding agents — OpenCode, OpenClaw, Hermes Agent, Cursor, or similar tools — install the Bkper CLI skill in that agent environment:

```bash
npx skills add bkper/bkper-cli --skill bkper-cli
```

The plugins and skill help external agents use the local `bkper` CLI with Bkper context, CLI references, and safety guidance.

For general Bkper Q&A without local tool access, use the published docs and [`llms.txt`](https://bkper.com/llms.txt) instead.

---

## Advanced agent options

`bkper agent` starts the same built-in agent experience as `bkper`.

Advanced users can pass supported agent-runtime flags through:

```bash
bkper agent <args>
bkper agent --help
```

`bkper agent` keeps Bkper defaults, including the Bkper system prompt, unless you explicitly override them. For the underlying agent runtime reference, see [Pi][Pi].

---

## Data Management

Manage books, files, accounts, transactions, and balances.

```bash
bkper book list
bkper account list -b <bookId>
bkper file list -b <bookId> --limit 100
bkper transaction list -b <bookId> -q 'on:2026' --format csv
bkper balance list -b <bookId> -q 'on:2026-12-31' --format csv
```

→ [Full Data Management reference](https://github.com/bkper/bkper-cli/blob/main/skill/references/cli/data-management.md)

---

## App Management

Build, deploy, and manage Bkper apps.

```bash
bkper app init my-app
bkper app get my-app --json
bkper app dev
bkper app sync
bkper app deploy
bkper app logs --last 50
bkper app logs my-app --level error
```

`bkper app logs` reads recent app logs kept for 15 days. Run it inside an app directory, or pass an app id like `bkper app logs my-app`. Use `--level warn` or `--level error` to focus on requests with warnings or errors. The default output is human-readable, and JSON is available with `--json`.

→ [Full App Management reference](https://github.com/bkper/bkper-cli/blob/main/skill/references/cli/app-management.md)

---

## Programmatic access

Use the CLI as the authentication bridge for scripts and direct API calls.

### Access Token

Use the access token for direct API calls from any tool. This requires a prior `bkper auth login`, and `bkper auth token` does not start an interactive login flow:

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
-   [Full CLI reference](https://github.com/bkper/bkper-cli/tree/main/skill/references) — data management, app building, taxes, and financial statements
