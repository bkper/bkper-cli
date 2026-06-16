# AGENTS.md - Bkper CLI Development Guide

## Overview

Bkper CLI is a command-line client for Bkper (financial accounting platform). The project uses TypeScript, Bun, Mocha for testing, and gts (Google TypeScript Setup) for code style enforcement.

## README file

The README.md file is the main documentation for the project, its showed at github and npm, as well
as serving as the content for the app listing on the Bkper website and main Dashboard.
It should be kept up to date with the latest features and usage instructions, and should be clear and concise for users of all levels.
In the high level it should be divided in a session user will see, and an expandable session for developers, more technical, with reference documentation and more detailed instructions.
Its a public facing document, so it should be written for a general audience, with a focus on clarity and ease of use.

### README restrictions

-   NEVER add internal technical or SDLC workflow details to README.md
-   NEVER document release labels, release automation, publishing policy, CI/CD flow, branch strategy, or maintainer-only procedures in README.md
-   Keep maintainer and contributor workflow details in CONTRIBUTING.md, AGENTS.md, or internal docs instead
-   If in doubt, prefer removing internal process detail from README.md rather than adding it

## Build Commands

```bash
# Full build (clean, compile, copy assets)
bun run build

# Development with TypeScript watch
bun run dev
```

> **Note:** The CLI builds worker bundles only (`bkper app build`). Client tooling (Vite) is owned by the app template and configured via `vite.config.ts`. The template's `npm run dev` runs both Vite and `bkper app dev` concurrently, and `npm run build` runs both `vite build` and `bkper app build`.

## Test Commands

```bash
# Run all tests
bun run test:all

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Run a single test file
TS_NODE_PROJECT=tsconfig.test.json npx mocha --config .mocharc.json test/unit/commands/apps/list.test.ts

# Run a single test (grep pattern)
TS_NODE_PROJECT=tsconfig.test.json npx mocha --config .mocharc.json --grep "should return proper" test/unit/**/*.test.ts
```

## Code Style Guidelines

### TypeScript Configuration

-   Extends Google TypeScript Setup (gts/tsconfig-google.json)
-   Strict mode enabled (`strict: true`)
-   ESM modules (`"type": "module"`)
-   Target: ES2015, Module: ESNext
-   Declaration files generated (`.d.ts` and `.d.ts.map`)

### Imports and Module Format

```typescript
// Standard import style
import { something } from './local-module.js';
import { namedExport } from 'external-package';

// Default import
import program from 'commander';

// Side-effect import (when needed)
import './some-module.js';

// Use .js extension in imports for ESM compatibility
```

### Naming Conventions

-   **Interfaces**: PascalCase (e.g., `GetBookParams`, `GroupNode`)
-   **Functions**: camelCase (e.g., `buildHierarchicalStructure`)
-   **Variables**: camelCase (e.g., `rootGroups`)
-   **Constants**: SCREAMING_SNAKE_CASE for config constants, camelCase for others
-   **Files**: kebab-case.ts (e.g., `local-auth-service.ts`)
-   **Classes**: PascalCase (e.g., `TransactionMergeOperation`)

### Type Safety

-   **NEVER use `as any`** - Use proper types or `unknown` with type guards
-   Use interfaces for object shapes, types for unions/primitives
-   Enable strict null checks - check for undefined/null before access
-   Use `async/await` for all asynchronous operations

### Error Handling

```typescript
// CLI command error pattern
try {
    await someOperation();
} catch (err) {
    console.error('Error doing operation:', err);
    process.exit(1);
}
```

### Code Organization

-   **Source files**: `src/` directory
-   **Tests**: `test/unit/` and `test/integration/` directories
-   **Build output**: `lib/` directory
-   **Domain logic**: `src/domain/` for reusable business logic
-   Use named exports for functions that will be imported
-   Group related functionality in dedicated directories

### Testing Conventions

-   Use Mocha with Chai (`expect` from 'chai')
-   Test files mirror source structure: `test/unit/commands/apps/list.test.ts` for `src/commands/apps/list.ts`
-   Helper utilities in `test/unit/helpers/`
-   Mock data fixtures in `test/unit/fixtures/`
-   Use `setupTestEnvironment()` and `getTestPaths(import.meta.url)` in tests

## Project Structure

```
src/
├── auth/           # Authentication services
├── commands/       # CLI command implementations
│   └── auth/       # Auth commands (login, logout, token)
├── domain/         # Domain-specific operations (reusable business logic)
│   └── transaction/ # Transaction merge operation
├── render/         # Output formatting (table, key-value, JSON)
└── cli.ts          # Main CLI entry point
```

## Common Operations

### Adding a new CLI command

1. Add command to `src/cli.ts`
2. Implement logic in `src/commands/`
3. Add tests in `test/unit/commands/`
4. Run `bun run build` to compile

## Derived Resources

Derived resources are read-only by default. Do not edit them during normal documentation work, and do not include them in scope unless the user explicitly asks to sync, generate, refresh, or rebuild them.

| Derived path | Canonical source | Regenerate only when explicitly requested |
| --- | --- | --- |
| `docs/core-concepts.md` | `https://bkper.com/docs/core-concepts.md` | `bun run sync:docs` |
| `docs/bkper-js.md` | `https://bkper.com/docs/api/bkper-js.md` | `bun run sync:docs` |
| `docs/bkper-api-types.md` | `https://bkper.com/docs/api/bkper-api-types.md` | `bun run sync:docs` |
| `docs/app-building.md` | `https://bkper.com/docs/build/apps/llms-full.txt` | `bun run sync:docs` |
| `lib/docs/**` | `docs/*.md` + `README.md` | `bun run build:copy-docs` or full build |
| `../skills/skills/bkper/SKILL.md` | `src/agent/system-prompt.ts` | `bun run generate:skill` |
| `../skills/skills/bkper/references/**` | `docs/*.md` | `bun run generate:skill` |

Notes:

- For docs changes in this repository, edit the canonical local docs only: `README.md`, `docs/app-management.md`, `docs/data-management.md`, `docs/financial-statements.md`, `docs/index.md`, or `docs/taxes.md` unless the user explicitly requests a sync.
- `bun run build` runs `prebuild`, which executes `bun sync:docs` and `bun generate:skill`. For documentation-only work or tasks that should not refresh derived resources, do not run full `bun run build` unless the user explicitly requested regeneration. Use targeted checks such as `bun run build:compile` or `bun run test:unit` when appropriate, and report that full build was skipped to avoid derived-resource churn.
- If a synced doc is stale or wrong, update the source in `bkper-mkt` docs first, then ask before running `bun run sync:docs` here.
- If the skill output is stale, update `src/agent/system-prompt.ts` or the relevant canonical docs first, then ask before running `bun run generate:skill`.

## Agent Workflow Guardrails

These rules are mandatory for coding agents working on this repository.

### Branch and PR workflow

-   Work directly on `main` by default for this CLI repository.
-   Create a short-lived feature branch or PR only when the user explicitly requests it, when `main` is protected/unavailable, or when a larger/riskier change warrants review and the user agrees.
-   Keep changes small, scoped, and single-purpose.
-   Do not bundle unrelated refactors with feature/fix work.

### Release workflow

Releases are published by GitHub Actions (Trusted Publisher with OIDC), not from local machines.

-   Merge work into `main` normally; release timing is decoupled from PRs.
-   When ready to release from a clean, up-to-date `main`, run one of:
    -   `bun run release:patch`
    -   `bun run release:minor`
    -   `bun run release:major`
-   Push the resulting commit and tag with `git push origin main --follow-tags`
-   CI publishes only from version tags matching `v*.*.*`

### Pi dependency automation policy

-   Dependabot tracks `@earendil-works/pi-coding-agent`.
-   Pi update PRs stay standard dependency PRs.
-   Do not add release labels or version bumps on Dependabot PR branches.

### Agent docs maintenance

`docs/index.md` is the routing index for the Bkper agent system prompt. The system prompt points to it for task routing — it is the map that tells the agent which doc to read for which intent.

When adding, renaming, or significantly restructuring docs in `docs/`, update `docs/index.md` in the same commit. Keep index entries intent-descriptive and concise.

Before pushing code changes to `main`, always run:

```bash
bun run build
bun run test:unit
```

### Publishing policy

-   Never publish manually from local environment unless explicitly instructed.
-   Publishing is performed by CI on version tag pushes, with Trusted Publisher (OIDC).
-   If publish fails, fix root cause and re-run through the tag-based release flow; do not bypass with ad-hoc changes.
