# Contributing to Bkper CLI

Thanks for contributing to `bkper-cli`.

This guide covers the day-to-day development flow and the release automation policy used in this repository.

---

## Development setup

- Node.js: `>=18`
- Package manager: `bun`

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
- `fix/auth-refresh-error`
- `feat/transaction-batch-filter`
- `chore/update-dependencies`

3. **Make small, focused changes**
- Keep each PR scoped to one problem.
- Prefer incremental changes over large refactors.

4. **Run checks locally before opening PR**

```bash
bun run build
bun run test:unit
```

5. **Open PR to `main`**
- Wait for CI to pass.
- Address review feedback.
- Merge when green.

---

## Release and label policy

Releases are automated and **label-driven**.

### Standard labels

- `release:none` → do not publish
- `release:patch` → publish patch version
- `release:minor` → publish minor version
- `release:major` → publish major version

### Pi dependency automation

This repository is configured to auto-release only for Pi dependency updates.

- Pi dependency updates are identified with label: `deps:pi`
- Dependabot applies:
  - `deps:pi`
  - one of `release:patch|minor|major` based on semver update type
- Pi patch updates are auto-merged (when checks pass)
- After merge, release workflow publishes automatically

If a merged PR does **not** include `deps:pi`, release workflow skips publishing.

---

## CI expectations

PRs are expected to pass:

- Build
- Unit tests

Keep your branch up to date with `main` if checks fail due to drift.

---

## Commit and PR quality

- Use clear commit messages.
- Describe user impact in PR description.
- Include reasoning for non-obvious decisions.
- Keep changelog/user-facing docs focused on user-relevant changes.

---

## Security and publishing

Publishing uses npm Trusted Publishers (OIDC) via GitHub Actions.

Do not add long-lived npm publish tokens to workflows unless explicitly required as an emergency fallback.
