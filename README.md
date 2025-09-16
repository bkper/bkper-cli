[Bkper REST API]: https://bkper.com/docs/#rest-api-enabling

A **command line** utility for managing [Bkper Apps and Bots](https://bkper.com/docs/) and running the [Model Context Protocol (MCP) server](https://modelcontextprotocol.io).

The MCP server enables AI assistants and agents to interact with your Bkper books through a standardized protocol.

[![npm](https://img.shields.io/npm/v/bkper?color=%235889e4)](https://www.npmjs.com/package/bkper)

## Installation

### Add the package:

```
npm i bkper
```

or

```
yarn add bkper
```

or

```
bun add bkper
```

Optionally, you can install it globally to be able to use the `bkper` command line utility:

```
npm i -g bkper
```

or

```
yarn global add bkper
```

## Commands

- `login` - Logs the user in. Saves the client credentials to a `~/.config/bkper/.bkper-credentials.json` file.
- `logout` - Logs out the user by deleting client credentials.
- `mcp start` - Start the Bkper MCP (Model Context Protocol) server.
- `app -c` - Create a new App based on `./bkperapp.yaml` file.
- `app -u` - Update an existing App based on `./bkperapp.yaml` file.

### Examples

```
npm bkper login
```

```
yarn bkper login
```

### MCP (Model Context Protocol) Server

Bkper includes an MCP server that allows AI assistants and other tools to interact with your Bkper books through the [Model Context Protocol](https://modelcontextprotocol.io).

#### Starting the MCP Server

```bash
bkper mcp start
```

The server runs on stdio and provides the following tools:

- **list_books** - List all books accessible by the authenticated user
- **get_book** - Get details of a specific book by ID
- **get_balances** - Get account balances for a specific date or period
- **list_transactions** - List transactions with filtering options

#### Prerequisites

Before using the MCP server:

1. Login using `bkper login` to set up authentication
2. Enable the [Bkper REST API]
3. Ensure the `BKPER_API_KEY` environment variable is set.

The MCP server uses the same authentication as the CLI, reading credentials from `~/.config/bkper/.bkper-credentials.json`.

#### Integration Examples

##### Claude Desktop

Add to your configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bkper": {
      "command": "npx",
      "args": ["bkper", "mcp", "start"],
      "env": {
        "BKPER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

##### Other MCP Clients

For other MCP-compatible clients, configure them to run:

```bash
BKPER_API_KEY=your-api-key npx bkper mcp start
```

The server communicates via stdio, so any MCP client that supports stdio transport can connect to it.

#### Available MCP Tools

Once connected, the MCP client can:

- List your Bkper books
- Get account balances for any date or period
- Search and filter transactions
- Analyze your financial data

For more information about the Model Context Protocol, visit [modelcontextprotocol.io](https://modelcontextprotocol.io).

## Apps and Bots

### Environment Variables

The following environment variable is necessary in order to communicate with the [Bkper REST API]:

```
BKPER_API_KEY=XXXX
```

The `app` command also uses the following variables in order to perform App create/update operations:

```
BKPER_CLIENT_SECRET=YYYY
BKPER_USER_EMAILS="someone@gmail.com anotherone@altrostat.com"
BKPER_DEVELOPER_EMAIL=somedeveloer@mycompany.com
```

You can add a `.env` file at the root of your project with those variables and bkper will automatically load from it.
Follow [these](https://bkper.com/docs/#rest-api-enabling) steps in order to configure a valid Bkper API key.

> WARNING: Never upload variables to the source code repository.

### `./bkperapp.yaml` Reference

```yaml
# BASIC APP CONFIGURATION

# The agent id of the App or Bot. It can NOT be changed after the App or Bot is created.
id: my-custom-app

# The readable name of the App or Bot.
name: My Custom App

# The logo url from public host. Best fit 200x200 px. Use https://
logoUrl: https://static.thenounproject.com/png/2318500-200.png

# The logo url to be used when in dark mode
logoUrlDark: https://static.thenounproject.com/png/2318500-200.png

# CONTEXT MENU CONFIGURATION

# The menu production url to open in the popup window. See accepted expressions bellow.
menuUrl: https://script.google.com/macros/s/AKfycbxz1Fl1A_KpvAtWLSXtGh1oRaFdWibPweoJfa3yYrFRAAC6gRM/exec?bookId=${book.id}

# The menu development url that will be used while developing.
menuUrlDev: https://script.google.com/a/bkper.com/macros/s/AKfycbwg42np5A-niYBI7Qq2yxOguhcoNgEkqqe0aRLw628/dev?bookId=${book.id}

# The context menu call to action.
menuText: Open My Custom App

menuPopupWidth: 500 # width in pixels. Default to 80% of screen width.
menuPopupHeight: 300 # height in pixels. Default to 90% of screen height.

# BOT EVENTS CONFIGURATION

# The webhook url to be called by Bkper when an event occurs.
webhookUrl: https://us-central1-bkper-tax-trigger.cloudfunctions.net/events

# The events the Bot is capable of processing by the webhook.
# This is optional and, if not specified, no events will be processed.
events:
  - "TRANSACTION_POSTED"
  - "TRANSACTION_CHECKED"
  - "TRANSACTION_UNCHECKED"
  - "TRANSACTION_UPDATED"
  - "TRANSACTION_DELETED"
  - "TRANSACTION_RESTORED"
  - "ACCOUNT_CREATED"
  - "ACCOUNT_UPDATED"
  - "ACCOUNT_DELETED"
  - "GROUP_CREATED"
  - "GROUP_UPDATED"
  - "GROUP_DELETED"
  - "FILE_CREATED"
  - "BOOK_UPDATED"

# The file patterns the Bot is capable of processing. It accepts wildcards. E.g.
filePatterns:
  - "radiusbank*.ofx"
  - "-*.qif"
  - "*.csv"

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

#### Accepted expressions in menuUrl property:

- `${book.id}` - the current book id
- `${book.properties.xxxxx}` - any property value from the current book
- `${transactions.query}` - the current query being executed on transactions list
- `${transactions.ids}` - the ids of selected transactions, splitted by comma
- `${account.id}` - the current account being filterd
- `${account.properties.xxxxx}` - any property value from the current account being filtered
- `${group.id}` - the current group being filterd
- `${group.properties.xxxxx}` - any property value from the current group being filtered

#### Example:

```json
"menuUrl": "https://app.bkper.com/b/#transactions:bookId=${book.id}"
```

#### Library

The `getOAuthToken` returns a Promise that resolves to a valid OAuth token, to be used by the [`bkper-js`](https://github.com/bkper/bkper-js) library

Example:

```javascript
import { Bkper } from "bkper-js";
import { getOAuthToken } from "bkper";

Bkper.setConfig({
  oauthTokenProvider: async () => getOAuthToken(),
});
```

## Documentation

- [Developer Docs](https://bkper.com/docs)
