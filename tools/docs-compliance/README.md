# Docs Compliance (bkper-cli)

Local checks to keep README command examples and guidance consistent with current CLI behavior.

## Commands

```bash
# Deterministic checks (fast, no API dependency)
bun run docs:compliance

# Optional live smoke checks (uses fixed defaults, supports overrides)
bun run docs:compliance:live

# Override defaults when needed
BKPER_DOCS_TEST_BOOK_ID=<bookId> \
BKPER_DOCS_TEST_ACCOUNT_NAME="Brex Cash" \
BKPER_DOCS_TEST_BS_GROUP="Balance Sheet" \
BKPER_DOCS_TEST_PL_GROUP="Profit & Loss" \
bun run docs:compliance:live
```

## Deterministic checks

- `bkper transaction list` examples must include `-q`/`--query`
- `bkper balance list` examples must include `-q`/`--query`
- Reject `after:$DATE before:$DATE` anti-pattern (prefer `on:$DATE`)
- Reject `period:` in query examples (prefer documented operators)
- Ensure README contains key guidance:
  - LLM-first output section
  - CSV for LLM list/report consumption
  - JSON for programmatic pipelines
  - Query semantics section with `after`/`before` semantics

## Live smoke checks

By default, live checks run with fixed local defaults in the script:

- Book: `Bkper Finances` (`agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgKTP5LcJDA`)
- Account: `Brex Cash`
- Balance Sheet group: `Bkper Balance Sheet`
- P&L group: `Bkper Profit & Loss`

Environment variable overrides:

- `BKPER_DOCS_TEST_BOOK_ID`
- `BKPER_DOCS_TEST_ACCOUNT_NAME`
- `BKPER_DOCS_TEST_BS_GROUP`
- `BKPER_DOCS_TEST_PL_GROUP`
- `BKPER_DOCS_CLI_CMD` (optional, defaults to `bkper`)

The live checks parse README `bash` blocks, extract runnable query examples (`transaction list` and `balance list` with `-q`), materialize placeholders using env vars, and validate successful execution with CSV-like output.
