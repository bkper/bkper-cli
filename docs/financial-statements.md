# Financial Statements — CLI Workflow

Use this guide when a user asks for a balance sheet, P&L, income statement, profit and loss, or any financial report from a Bkper book.

## Workflow

### Step 1 — Discover root groups

```bash
bkper group list -b <bookId> --format csv
```

Inspect the output and identify **top-level groups** (no parent). Root group names vary by book — common examples: `Total Equity`, `Balance Sheet`, `Profit & Loss`, `Results`, `Net Worth`.

Identify each root group by the account types it contains:

| Root group contains              | Statement                        |
| -------------------------------- | -------------------------------- |
| ASSET and/or LIABILITY accounts  | Balance Sheet                    |
| INCOMING and/or OUTGOING accounts | Profit & Loss (Income Statement) |

### Step 2 — Fetch the balances

**Balance Sheet** — permanent accounts, cumulative position at a point in time:

```bash
bkper balance list -b <bookId> \
  -q "group:'<rootGroup>' before:<date>" \
  --format csv --expanded 2
```

**Profit & Loss / Income Statement** — non-permanent accounts, activity within a period:

```bash
bkper balance list -b <bookId> \
  -q "group:'<rootGroup>' after:<start> before:<end>" \
  --format csv --expanded 2
```

### Step 3 — Present results

Format as a structured financial statement with clear sections, group totals, and the period label.

---

## Date patterns

| Request        | Balance Sheet              | Profit & Loss                  |
| -------------- | -------------------------- | ------------------------------ |
| Current month  | `before:$m`                | `after:$m-1 before:$m`         |
| Current year   | `before:$y`                | `after:$y-1 before:$y`         |
| Full year 2024 | `before:2025-01-01`        | `after:2024-01-01 before:2025-01-01` |

- `after:` is **inclusive**, `before:` is **exclusive**
- `$d` = today, `$m` = current month-end, `$y` = current year-end
- In shell, wrap queries containing `$` variables in **single quotes** to prevent shell expansion

---

## Key rules

- **Always use the ROOT group** — never subgroups like `Assets`, `Liabilities`, `Revenue`, `Expenses`
- **Balance Sheet** uses `before:` only — permanent accounts accumulate continuously
- **P&L** uses `after:` + `before:` — non-permanent accounts track period activity
- **Use `--format csv`** for token efficiency when loading results into an LLM context
- **Use `--expanded 2`** to see meaningful sub-totals in the hierarchy

---

## Common mistakes

| Wrong                                          | Right                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `group:'Assets' before:2025-01-01`             | `group:'Total Equity' before:2025-01-01` — use root group, not subgroup |
| `before:$m` for P&L                            | `after:$m-1 before:$m` — P&L needs a period, not just an end date   |
| `after:$y-1 before:$d`                         | `after:$y-1 before:$y` — use consistent date basis on both ends      |
| `-q 'before:2025-01-01'` without group filter  | `-q "group:'<rootGroup>' before:2025-01-01"` — always filter by group |
