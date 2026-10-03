# Contributing to Bkper CLI

Thanks for contributing to `bkper-cli`.

This guide covers the day-to-day development flow and the release automation policy used in this repository.

---

## Development setup

-   Node.js: `>=22.19.0`
-   Package manager: `bun`

Install dependencies:

```bash
bun install
```

Run local checks:

```bash
bun run build
bun run test:unit
```

---

## Prompt routing evaluations

The router batches pending loader questions into one Bkper AI Jev request. Loaders
own their questions, thresholds, fallbacks, injection, and session persistence.
Register additional loaders with the shared router in `src/agent/extensions/builtins.ts`.

Core concepts loads for finance, accounting, or requests needing Bkper knowledge.
Unspecified accounts, transactions, books, and bots normally mean Bkper in this CLI;
explicit unrelated domains and changes of topic should not trigger loading.
The production threshold is `0.4`. Routing sends at most 16,000 characters of the
current prompt plus the last three user messages, each capped at 2,000 characters,
to Bkper AI. It excludes assistant/tool output and images. A five-second deadline
covers authentication/availability and classification. On failure, each loader uses
its fallback; core concepts checks domain keywords in the same bounded context.
This fallback intentionally favors loading and can produce false positives.
Once loaded, core concepts no longer needs classification on subsequent prompts.

Versioned evaluation sources:

- `src/agent/core-concepts-routing.ts`: production question, threshold, and fallback.
- `test/tools/prompt-routing/cases.ts`: synthetic prompts, recent user context, and
  expected decisions. Keep case IDs stable and expectations independent of model
  results. Labels and IDs are never sent to Jev.
- `test/tools/prompt-routing/variants.ts`: named experimental questions evaluated
  beside production in one request per case.

Run deterministic behavior tests with `bun run test:unit`. Live evaluations are
opt-in, use your Bkper login and AI allowance, and do not write to Books:

```bash
bun run eval:prompt-routing > /tmp/prompt-routing-eval.json
```

The JSON report contains questions, thresholds, per-case probabilities, latency,
confusion counts, and separate provider/fallback errors. It compares thresholds
from `0.3` through `0.7`; a longer 30-second request deadline isolates question
quality from the production latency limit. Exit status is nonzero for production
mismatches or provider errors; experimental mismatches are reported only.
Reports are local artifacts, not fixtures. Commit changes to cases, question
variants, and production routing together when iterating. Synthetic cases are a
starting point, not evidence of production accuracy; add anonymized real-world
misses and re-evaluate as Jev changes.

---

## Daily coding workflow

1. **Sync main**

```bash
git checkout main
git pull
```

2. **Create a short-lived branch**

```bash
git checkout -b <type>/<short-description>
```

Examples:

-   `fix/auth-refresh-error`
-   `feat/transaction-batch-filter`
-   `chore/update-dependencies`

3. **Make small, focused changes**

-   Keep each PR scoped to one problem.
-   Prefer incremental changes over large refactors.

4. **Run checks locally before opening PR**

```bash
bun run build
bun run test:unit
```

5. **Open PR to `main`**

-   Wait for CI to pass.
-   Address review feedback.
-   Merge when green.

---

## Changelog policy

-   Add user-facing changes under `[Unreleased]` using the existing domain categories.
-   Before a release, move those entries under `[version] - YYYY-MM-DD`, add a fresh `[Unreleased]` section, and commit the changelog.
-   Omit versions that have no user-facing changelog entry.

## Release workflow

Releases are automated and **tag-driven**.

1. Start from a clean, up-to-date `main`
2. Finalize and commit the changelog as described above
3. Run one of:

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

4. Push the release commit and tag:

```bash
git push origin main --follow-tags
```

GitHub Actions publishes only from version tags matching `v*.*.*`.

## CI expectations

PRs are expected to pass:

-   Build
-   Unit tests

Keep your branch up to date with `main` if checks fail due to drift.

---

## Commit and PR quality

-   Use clear commit messages.
-   Describe user impact in PR description.
-   Include reasoning for non-obvious decisions.
-   Keep changelog/user-facing docs focused on user-relevant changes.

---

## Security and publishing

Publishing uses npm Trusted Publishers (OIDC) via GitHub Actions.

Do not add long-lived npm publish tokens to workflows unless explicitly required as an emergency fallback.
