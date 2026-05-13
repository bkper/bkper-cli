# Plan: CLI File Upload and Transaction Attachments (v1)

## Motivation

Users already rely on Bkper file workflows in the product:

- upload a file to a Book and let apps like **Bkper Agent** process it on `FILE_CREATED`
- attach a receipt/invoice/photo while creating a transaction

The CLI currently supports transaction URLs and remote ids, but it does **not** support:

- creating Book files from local disk
- attaching a local file while creating a transaction

This plan adds those capabilities while preserving the existing platform semantics.

### Zero-sum safety

These changes do **not** alter Bkper's movement model or balances. Files are contextual resources attached to Books or Transactions. The zero-sum invariant remains protected because this work only adds metadata/evidence workflows around transactions, not new balance logic.

---

## Current system findings

### 1. File is already a first-class Bkper resource

The platform and SDK already support Book files directly:

- Core API: `POST /books/{bookId}/files`
- SDK: `new File(book, payload).create()`
- Transactions already support `files`

So the CLI gap is UX/exposure, not platform capability.

### 2. There are already two distinct file workflows in Bkper

#### A. Standalone Book file upload

Intent:
- create a file in the Book
- optionally route processing by file properties such as `account_id` or `group_id`
- trigger `FILE_CREATED`

Current behavior found in the codebase:
- Core publishes `FILE_CREATED` when a Book file is created
- PWA/GWT direct book upload flows set `account_id` in some contexts
- `bkper-agent` `EventHandlerFileCreated` processes normal uploaded files

#### B. Transaction attachment workflow

Intent:
- attach a file to a transaction being created/edited
- skip normal file-created ingestion
- let the transaction flow carry the accounting context

Current behavior found in the codebase:
- `bkper-js` `Transaction.addFile(file)` + `transaction.create()` uploads pending files before persisting the transaction
- during that upload, the SDK marks the file with:
  - `upload_method=attachment`
- `bkper-agent` `EventHandlerFileCreated` skips files with `upload_method=attachment`
- `bkper-agent` `EventHandlerTransactionCreated` then uses the first attached file for invoice/receipt extraction/autofill

### 3. `account_id` and `group_id` are workflow properties, not arbitrary metadata

`bkper-agent` lookup priority for files includes:
- `account_id` / `account_id_`
- `group_id` / `group_id_`
- filename matching
- book/group/account prompt properties

So file properties are part of the workflow contract, not just decoration.

### 4. Batch transaction creation is the wrong attachment path for v1

Important SDK finding:

- `Transaction.create()/update()/post()` create pending files first
- `Book.batchCreateTransactions()` does **not** perform that pending-file upload flow

That means local-file attachments fit naturally with **single transaction create**, not stdin batch create.

### 5. Attachment-driven extraction currently uses only the first attachment

`bkper-agent`'s `EventHandlerTransactionCreated` currently processes only the first attachment. Transaction payload `files` are also modeled as a set in the API payload, so strong attachment ordering semantics are not a good v1 foundation.

---

## Agreed scope

### v1 commands

#### Standalone Book file upload

```bash
bkper file upload <path> -b <bookId> [--account <accountIdOrName>] [-p key=value ...]
```

#### Transaction create with local attachment

```bash
bkper transaction create -b <bookId> [existing flags...] [--file <path>]
```

### Explicitly deferred from v1

- `bkper transaction update --file ...`
- `--file-id` / attach existing uploaded file by id
- batch stdin/local file attachment support
- generic file management commands (`file list`, `file get`, `file delete`, etc.)
- multi-file attachment-on-create
- dedicated `--group` flag
- dedicated `--file-account` flag
- `--name` override flag
- `--content-type` override flag
- stdin/JSON-driven `file upload`

---

## Agreed design decisions

### A. `file upload` is a top-level resource command

The CLI should expose files as a top-level resource, consistent with Books, Accounts, Groups, Transactions, Balances, and Collections.

Canonical v1 command:

```bash
bkper file upload <path> -b <bookId>
```

### B. `upload` is the right verb for the CLI

Even though the core API uses “create”, the CLI action is specifically sending a local file from disk. “Upload” matches the product language and user mental model.

### C. `file upload` path is positional

The local path is the primary operand of the command, so it should be positional:

```bash
bkper file upload ./receipt.jpg -b <bookId>
```

### D. `file upload` supports optional `--account`

```bash
bkper file upload receipt.jpg -b <bookId> --account "Credit Card"
bkper file upload receipt.jpg -b <bookId> --account acc_123
```

Behavior:
- `--account` accepts either account **name** or **id**
- the CLI resolves it through `book.getAccount(idOrName)`
- the persisted file property is always canonical:
  - `account_id=<resolvedAccountId>`

If the account cannot be resolved, the command fails and the file is **not** uploaded.

### E. `file upload` supports generic repeatable properties

```bash
bkper file upload statement.pdf -b <bookId> -p statement_period=2025-01
bkper file upload statement.pdf -b <bookId> -p group_id=grp_123
```

This keeps the CLI aligned with Bkper's property-first extension model.

### F. `--account` and raw `account_id` are mutually exclusive

This must be rejected:

```bash
bkper file upload receipt.jpg -b <bookId> --account "Credit Card" -p account_id=acc_123
```

Reason: avoid precedence rules and conflicting inputs.

### G. Raw `-p account_id=...` is still allowed if `--account` is not used

This remains valid:

```bash
bkper file upload receipt.jpg -b <bookId> -p account_id=acc_123
```

This preserves advanced/scripted workflows while keeping `--account` as the human-friendly convenience alias.

### H. `file upload` must forbid `upload_method`

At minimum, this must be rejected:

```bash
bkper file upload receipt.jpg -b <bookId> -p upload_method=attachment
```

Reason:
- `upload_method=attachment` is the semantic switch that separates standalone uploads from attachment workflow
- allowing it on standalone upload would blur the two distinct workflows

### I. No dedicated `--group` flag in v1

If users need group-based routing, they can use raw properties:

```bash
bkper file upload statement.pdf -b <bookId> -p group_id=grp_123
```

### J. `file upload` is single-file, path-only, and generic

V1 rules:
- exactly one local path per command
- no stdin/JSON mode
- any file type is allowed
- local basename is preserved as the Bkper file name
- no CLI-side file size cap
- no `--name` flag
- no `--content-type` flag

### K. `file upload` outputs the created File resource normally

The command should return the created File resource using the existing single-resource render behavior, honoring current format handling.

---

## Transaction create attachment design

### A. Canonical flag is `--file <path>`

```bash
bkper transaction create -b <bookId> --file receipt.jpg
```

Reason:
- concise
- matches the transaction `files` field
- consistent with the top-level `file` resource naming

### B. `--file` is single-file only in v1

This must be rejected:

```bash
bkper transaction create -b <bookId> --file a.jpg --file b.jpg
```

Reason:
- `bkper-agent` currently only uses the first attachment on `TRANSACTION_CREATED`
- strong multi-attachment semantics would be misleading in v1

### C. `--file` is only for single-create mode

This must be rejected:

```bash
echo '[{...}]' | bkper transaction create -b <bookId> --file receipt.jpg
```

Reason:
- stdin create uses batch create flow
- batch create does not perform the pending-file upload behavior used by `Transaction.addFile(...); transaction.create()`

### D. `--file` is a pure attachment feature

It must **not** introduce separate file-level context flags or hidden account-routing semantics.

So v1 intentionally excludes:
- `--file-account`
- automatic `account_id` setting on attached files

The transaction's normal fields (`--from`, `--to`, amount, date, description) remain the main accounting context.

### E. `--file` does not force draft

`transaction create --file` should preserve the command's normal existing behavior:

- incomplete transaction -> draft
- complete transaction -> follow existing create/autopost semantics of the Book

This keeps `--file` additive rather than magical.

### F. File-only draft is valid

This should be allowed in v1:

```bash
bkper transaction create -b <bookId> --file receipt.jpg
```

This matches existing draft behavior and supports attachment-first receipt/invoice capture.

### G. Output stays unchanged

`transaction create --file` should keep the existing output contract:
- return the created transaction normally
- attachment appears in the standard `files` field if present
- no special output mode

---

## Validation and error behavior

### `file upload` failures

The command should fail hard before any API write when:
- the local path does not exist
- the path is a directory instead of a regular file
- the file is unreadable
- `--account` cannot be resolved
- `--account` is combined with `-p account_id=...`
- `-p upload_method=...` is provided
- any `-p` flag is malformed

### `transaction create --file` failures

The command should fail hard before any API write when:
- the local path does not exist
- the path is a directory instead of a regular file
- the file is unreadable
- stdin JSON is present together with `--file`
- `--file` is provided more than once

Where practical, validation should happen before the command mutates remote state.

---

## Implementation approach

### Phase 1: local file helper

Add a small Node-side helper for converting a local filesystem path into a Bkper file payload.

Recommended new helper file:

```text
src/utils/local-file.ts
```

Responsibilities:
- validate path exists
- ensure it is a regular file
- read file bytes from disk
- capture file size from stat
- use local basename as file name
- encode content as base64 string
- return a small payload suitable for `new File(book, payload)`

Important note:
- no MIME dependency is required for v1
- backend/platform inference should remain the source of truth for content type
- plain base64 content is acceptable for the platform path

### Phase 2: add `file` command

Recommended new files:

```text
src/commands/files/index.ts
src/commands/files/upload.ts
src/commands/files/register.ts
```

Behavior in `upload.ts`:
- load Book
- validate and read local file
- apply `--account` resolution if present
- merge/apply raw `-p` properties
- reject forbidden/conflicting property inputs
- create `new File(book, payload)`
- call `file.create()`
- return created File resource

Update CLI registration:

```text
src/cli.ts
```

Add:
- `registerFileCommands(program)`

### Phase 3: extend transaction create single-path flow

Files to modify:

```text
src/commands/transactions/create.ts
src/commands/transactions/register.ts
src/commands/transactions/index.ts
```

Behavior:
- in single-create mode only, accept `--file <path>`
- load local file through the helper
- build `new File(book, payload)`
- call `transaction.addFile(file)` before `transaction.create()`
- rely on `bkper-js` pending-file creation to set `upload_method=attachment`

Important:
- do not change stdin batch create path
- reject stdin + `--file`

### Phase 4: commander parsing / duplicate detection

Commander normally risks silently overriding repeated scalar flags.

For `transaction create --file`, implementation must detect duplicate flag usage explicitly and reject it.

Possible implementation strategies:
- use a repeatable collector and then validate `length <= 1`
- or inspect raw option occurrences before command execution

The important requirement is external behavior:
- repeated `--file` must be an error, not “last one wins”

### Phase 5: docs update

Files likely to update when implementation lands:

```text
README.md
docs/data-management.md
```

Needed documentation updates:
- new Files section for `bkper file upload`
- new examples for uploading a file
- transaction create examples with `--file`
- explicit note that `transaction create --file` is single-create only and not compatible with stdin batch mode
- explicit note that automatic app processing depends on downstream app/file-pattern behavior, not CLI-side file filtering

---

## Test plan for implementation

Implementation should follow repository TDD rules.

### Unit tests

Recommended new/updated test files:

```text
test/unit/commands/files/upload.test.ts
test/unit/commands/transactions/create.test.ts
```

Coverage to add:

#### `file upload`
- uploads a local file successfully
- preserves basename as file name
- sets raw properties
- resolves `--account` by name or id and persists canonical `account_id`
- fails if account is not found
- fails if `--account` and `-p account_id=...` are combined
- fails if `-p upload_method=...` is provided
- fails for missing/unreadable/non-regular local file path

#### `transaction create --file`
- attaches one local file before create
- allows file-only draft create
- preserves existing output contract through returned transaction payload
- fails if stdin input is present together with `--file`
- fails if `--file` is repeated
- fails for missing/unreadable/non-regular local file path

### Integration tests

Recommended new/updated integration files:

```text
test/integration/files/file-commands.test.ts
test/integration/transactions/transaction-commands.test.ts
```

Coverage to add:

#### `file upload`
- command returns created file resource
- file properties include resolved `account_id` when `--account` is used

#### `transaction create --file`
- created transaction includes one attached file
- file-only draft path works
- stdin + `--file` is rejected cleanly

---

## Files inventory for later implementation

### New files

```text
src/commands/files/index.ts
src/commands/files/register.ts
src/commands/files/upload.ts
src/utils/local-file.ts
test/unit/commands/files/upload.test.ts
test/integration/files/file-commands.test.ts
```

### Existing files to modify

```text
src/cli.ts
src/commands/transactions/create.ts
src/commands/transactions/register.ts
src/commands/transactions/index.ts
README.md
docs/data-management.md
test/unit/commands/transactions/create.test.ts
test/integration/transactions/transaction-commands.test.ts
```

---

## Deferred backlog

Items intentionally excluded from v1:

- `bkper file get/list/update/delete`
- `bkper transaction update --file`
- `bkper transaction create --file-id <existingFileId>`
- multi-file attach-on-create
- batch file upload
- batch transaction create with local file attachment
- dedicated `--group` convenience flag
- dedicated `--name` or `--content-type` flags
- CLI-side file type restrictions
- CLI-side file size restrictions

---

## Summary

This v1 plan keeps the CLI aligned with how Bkper already works:

- **`bkper file upload`** -> normal standalone Book file creation
- **`bkper transaction create --file`** -> normal transaction creation with a local attachment

The plan deliberately avoids collapsing those two workflows into one ambiguous feature, because the platform already distinguishes them using events and file properties.
