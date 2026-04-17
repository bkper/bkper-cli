# Data Management

Interact with books, accounts, transactions, and balances using the `bkper` CLI.

All commands that operate within a book use `-b, --book <bookId>` to specify the book context.

---

## Books

Create and manage financial books with locale-specific settings.

```bash
# List all books
bkper book list

# Get book details
bkper book get abc123

# Create a book with Brazilian settings
bkper book create --name "My Company" --fraction-digits 2 \
  --date-pattern "dd/MM/yyyy" --decimal-separator COMMA \
  --time-zone "America/Sao_Paulo"

# Create a book with custom properties
bkper book create --name "Project X" -p "code=PX001" -p "department=Engineering"

# Update a book
bkper book update abc123 --lock-date 2024-12-31
```

<details>
<summary>Command reference</summary>

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

</details>

---

## Accounts

Manage your chart of accounts within a book.

```bash
# List all accounts
bkper account list -b abc123

# Get an account by name
bkper account get "Bank Account" -b abc123

# Create an asset account
bkper account create -b abc123 --name "Bank Account" --type ASSET --groups "Current Assets"

# Update an account
bkper account update "Bank Account" -b abc123 --type LIABILITY

# Archive an account
bkper account update "Old Account" -b abc123 --archived true

# Delete an account
bkper account delete "Old Account" -b abc123
```

<details>
<summary>Command reference</summary>

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

</details>

---

## Groups

Organize accounts into hierarchical groups for structured reporting.

```bash
# List all groups (shows hierarchy)
bkper group list -b abc123

# Create a group
bkper group create -b abc123 --name "Current Assets"

# Create a child group
bkper group create -b abc123 --name "Cash" --parent "Current Assets"

# Update a group
bkper group update "Cash" -b abc123 --hidden true

# Delete a group
bkper group delete "Cash" -b abc123
```

### Book setup guidance (important)

When setting up a full Book or starter chart of accounts, prefer a hierarchical group structure by default.

Create top-level groups first, then child groups with `--parent`, then accounts with `--groups`.

Verify the resulting group hierarchy and account memberships before reporting success.

Avoid using the same name for a Group and an Account in the same Book.

<details>
<summary>Command reference</summary>

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

</details>

---

## Transactions

Record, query, and manage financial transactions.

```bash
# Create a draft transaction
bkper transaction create -b abc123 --description "Office supplies"

# Create a complete transaction
bkper transaction create -b abc123 --date 2025-01-15 --amount 100.50 \
  --from "Bank Account" --to "Office Supplies" --description "Printer paper"

# List transactions for a full year (on:YYYY)
bkper transaction list -b abc123 -q 'on:2025'

# List transactions for a month (on:YYYY-MM)
bkper transaction list -b abc123 -q 'on:2025-01'

# List with custom properties included
bkper transaction list -b abc123 -q 'account:Sales' -p

# Update a transaction
bkper transaction update tx_456 -b abc123 --amount 120.00 --description "Printer paper (corrected)"

# Post a draft transaction
bkper transaction post tx_456 -b abc123

# Check (reconcile) a transaction
bkper transaction check tx_456 -b abc123

# Trash a transaction
bkper transaction trash tx_456 -b abc123

# Merge two duplicate transactions
bkper transaction merge tx_123 tx_456 -b abc123
```

<details>
<summary>Command reference</summary>

-   `transaction list -b <bookId> -q <query>` - List transactions matching a query (auto-paginates through all results)
    -   `-p, --properties` - Include custom properties in the output
-   `transaction create -b <bookId>` - Create a transaction
    -   `--date <date>` - Transaction date
    -   `--amount <amount>` - Transaction amount
    -   `--description <description>` - Transaction description
    -   `--from <from>` - Credit account (source)
    -   `--to <to>` - Debit account (destination)
    -   `--url <url>` - URL (repeatable)
    -   `--remote-id <remoteId>` - Remote ID (repeatable)
    -   `-p, --property <key=value>` - Set a property (repeatable, empty value deletes)
-   `transaction update [transactionId] -b <bookId>` - Update a transaction (or batch update via stdin)
    -   `--date <date>` - Transaction date
    -   `--amount <amount>` - Transaction amount
    -   `--description <description>` - Transaction description
    -   `--from <from>` - Credit account (source)
    -   `--to <to>` - Debit account (destination)
    -   `--url <url>` - URL (repeatable, replaces all)
    -   `--update-checked` - Also update checked transactions
    -   `-p, --property <key=value>` - Set a property (repeatable, empty value deletes)
-   `transaction post <id> -b <bookId>` - Post a draft transaction
-   `transaction check <id> -b <bookId>` - Check a transaction
-   `transaction trash <id> -b <bookId>` - Trash a transaction
-   `transaction merge <id1> <id2> -b <bookId>` - Merge two transactions

</details>

---

## Balances

Query account balances and group totals.

```bash
# List balances for a specific date (point-in-time)
bkper balance list -b abc123 -q 'on:2025-12-31'

# Monthly balance evolution of one account during 2025
bkper balance list -b abc123 -q "account:'<accountName>' after:2025-01-01 before:2026-01-01 by:m" --expanded 2
```

<details>
<summary>Command reference</summary>

-   `balance list -b <bookId> -q <query>` - List balances
    -   `--expanded <level>` - Expand groups to specified depth (`0`+)

</details>

---

## Query Semantics

Use the same query language across Bkper web app, CLI, and Google Sheets integrations.

-   `on:` supports different granularities:
    -   `on:2025` → full year
    -   `on:2025-01` → full month
    -   `on:2025-01-31` → specific day
-   `after:` is **inclusive** and `before:` is **exclusive**.
    -   Full year 2025: `after:2025-01-01 before:2026-01-01`
-   In shell commands, wrap queries with Bkper date variables (`$d`, `$m`, `$y`) in single quotes to avoid shell expansion.
    -   Example: `bkper transaction list -b abc123 -q 'after:$m-3 before:$m+1'`
    -   If the query already needs single quotes inside (for example, `account:'Brex Cash'`), keep double quotes and escape `$`: `-q "account:'Brex Cash' after:\$m-3 before:\$m+1"`
-   For point-in-time statements (typically permanent accounts `ASSET`/`LIABILITY`), prefer `on:` or `before:`.
-   For activity statements over a period (typically non-permanent accounts `INCOMING`/`OUTGOING`), prefer `after:` + `before:`.
-   For statement-level analysis, prefer filtering by the report root group. Root names vary by book — run `bkper group list -b <bookId>` first to discover them: top-level groups containing `ASSET`/`LIABILITY` accounts are Balance Sheet roots; those containing `INCOMING`/`OUTGOING` accounts are P&L roots.

```bash
# Discover root groups
bkper group list -b abc123

# Balance Sheet snapshot (point-in-time)
bkper balance list -b abc123 -q "group:'<balanceSheetRootGroup>' before:2026-01-01"

# P&L activity over 2025
bkper balance list -b abc123 -q "group:'<profitAndLossRootGroup>' after:2025-01-01 before:2026-01-01"
```

For the full balance sheet and P&L workflow, see the [Financial Statements guide](https://github.com/bkper/bkper-cli/blob/main/docs/financial-statements.md).

---

## Collections

Organize books into collections.

```bash
# Create a collection
bkper collection create --name "My Collection"

# Add books to a collection
bkper collection add-book col_789 -b abc123 -b def456

# List all collections
bkper collection list

# Remove a book from a collection
bkper collection remove-book col_789 -b abc123

# Delete a collection
bkper collection delete col_789
```

<details>
<summary>Command reference</summary>

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

</details>

---

## Output Format

All commands support three output formats via the `--format` global flag:

| Format | Flag                       | Best for                                    |
| ------ | -------------------------- | ------------------------------------------- |
| Table  | `--format table` (default) | Human reading in the terminal               |
| JSON   | `--format json`            | Programmatic access, single-item detail     |
| CSV    | `--format csv`             | LLM consumption, spreadsheets, list reports |

```bash
# Table output (default)
bkper account list -b abc123

# JSON output
bkper account list -b abc123 --format json

# CSV output -- raw data, no truncation, RFC 4180
bkper account list -b abc123 --format csv
```

**CSV output details:**

-   **RFC 4180 compliant** -- proper quoting, CRLF line endings, no truncation
-   **All metadata included** -- IDs, properties, hidden properties, URLs, and timestamps are enabled
-   **Raw values** -- dates stay in ISO format, numbers are unformatted (no locale formatting)
-   **Single-item commands** (e.g. `account get`, `transaction create`) fall back to JSON since CSV adds no value for non-tabular data

**LLM-first output guidance (important):**

When command output will be loaded into an LLM context (chat, prompt, memory, or agent reasoning), prefer:

-   **`--format csv` for list commands** (`balance list`, `transaction list`, `account list`, etc.).
-   **`--format json` for single-item commands** (`get`, `create`, `update`) and CLI-to-CLI pipelines.

CSV is significantly more token-efficient than JSON for tabular data, and for wide balance outputs it can reduce token usage by up to **95%**.

**Quick rule:**

-   **LLM consumption of lists/reports** → CSV
-   **Programmatic processing / pipelines** → JSON
-   **Human terminal reading** → Table

---

## Batch Operations & Piping

Write commands (`account create`, `transaction create`) accept JSON data piped via stdin for batch operations. The `transaction update` command also accepts stdin for batch updates. The input format follows the [Bkper API Types](https://raw.githubusercontent.com/bkper/bkper-api-types/refs/heads/master/index.d.ts) exactly -- a single JSON object or an array of objects.

```bash
# Create transactions
echo '[{
  "date": "2025-01-15",
  "amount": "100.50",
  "creditAccount": {"name": "Bank Account"},
  "debitAccount": {"name": "Office Supplies"},
  "description": "Printer paper",
  "properties": {"invoice": "INV-001"}
}]' | bkper transaction create -b abc123

# Create accounts
echo '[{"name":"Cash","type":"ASSET"},{"name":"Revenue","type":"INCOMING"}]' | \
  bkper account create -b abc123

# Pipe from a script
python export_bank.py | bkper transaction create -b abc123
```

The input follows the exact `bkper.Transaction` or `bkper.Account` type from the [Bkper API Types](https://raw.githubusercontent.com/bkper/bkper-api-types/refs/heads/master/index.d.ts). Custom properties go inside the `properties` object.

Groups are created explicitly with `bkper group create --name` and optional `--parent` so hierarchy stays deterministic during setup.

The `--property` CLI flag can override or delete properties from the stdin payload:

```bash
echo '[{"name":"Cash","type":"ASSET"}]' | \
  bkper account create -b abc123 -p "region=LATAM"
```

**Batch output:** results are output as a flat JSON array, matching the same format as list commands:

```bash
bkper account create -b abc123 < accounts.json
# Output: [{"id":"acc-abc","name":"Cash",...}, {"id":"acc-def","name":"Revenue",...}]
```

**Piping between commands:**

For resources that support stdin creation, JSON output can be piped directly into create or update commands:

```bash
# Copy all accounts from one book to another
bkper account list -b $BOOK_A --format json | bkper account create -b $BOOK_B

# Copy transactions matching a query
bkper transaction list -b $BOOK_A -q 'after:2025-01-01' --format json | \
  bkper transaction create -b $BOOK_B

# Clone accounts, then transactions
bkper account list -b $SOURCE --format json | bkper account create -b $DEST
bkper transaction list -b $SOURCE -q 'after:2025-01-01' --format json | \
  bkper transaction create -b $DEST

# Batch update: list transactions, modify, and pipe back to update
bkper transaction list -b $BOOK -q 'after:2025-01-01' --format json | \
  jq '[.[] | .description = "Updated: " + .description]' | \
  bkper transaction update -b $BOOK

# Batch update: add a property to all matching transactions
bkper transaction list -b $BOOK -q 'account:Expenses' --format json | \
  bkper transaction update -b $BOOK -p "reviewed=true"

# Batch update checked transactions
bkper transaction list -b $BOOK -q 'is:checked after:2025-01-01' --format json | \
  bkper transaction update -b $BOOK --update-checked -p "migrated=true"
```

<details>
<summary>Writable fields reference</summary>

Only the fields below are meaningful when creating or updating resources via stdin. For batch updates, items must include an `id` field. Other read-only fields (`createdAt`, `updatedAt`, etc.) are ignored.

**Transaction** (`bkper.Transaction`)

| Field           | Type                               | Notes                                         |
| --------------- | ---------------------------------- | --------------------------------------------- |
| `id`            | `string`                           | Required for batch updates, ignored on create |
| `date`          | `string`                           | ISO format `yyyy-MM-dd`                       |
| `amount`        | `string`                           | Decimal format `####.##` (string, not number) |
| `creditAccount` | `{"name":"..."}` or `{"id":"..."}` | Reference to an existing account              |
| `debitAccount`  | `{"name":"..."}` or `{"id":"..."}` | Reference to an existing account              |
| `description`   | `string`                           | Free-text description                         |
| `urls`          | `string[]`                         | Attached URLs (e.g. receipts)                 |
| `remoteIds`     | `string[]`                         | External IDs to prevent duplicates            |
| `properties`    | `{"key": "value", ...}`            | Custom key/value properties                   |

**Account** (`bkper.Account`)

| Field        | Type                    | Notes                                              |
| ------------ | ----------------------- | -------------------------------------------------- |
| `name`       | `string`                | Account name (required)                            |
| `type`       | `string`                | `ASSET`, `LIABILITY`, `INCOMING`, or `OUTGOING`    |
| `credit`     | `boolean`               | Credit nature (`true`) or debit (`false`)          |
| `archived`   | `boolean`               | Archive the account on creation                    |
| `permanent`  | `boolean`               | Permanent accounts (e.g. bank accounts, customers) |
| `groups`     | `[{"name":"..."}, ...]` | Groups to assign by name or id                     |
| `properties` | `{"key": "value", ...}` | Custom key/value properties                        |

</details>
