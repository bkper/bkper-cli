# AGENTS.md - Bkper CLI Development Guide

## Overview

Bkper CLI is a command-line client for Bkper (financial accounting platform). The project uses TypeScript, Bun, Mocha for testing, and gts (Google TypeScript Setup) for code style enforcement.

## README file

The README.md file is the main documentation for the project, its showed at github and npm, as well
as serving as the content for the app listing on the Bkper website and main Dashboard.
It should be kept up to date with the latest features and usage instructions, and should be clear and concise for users of all levels.
In the high level it should be divided in a session user will see, and an expandable session for developers, more technical, with reference documentation and more detailed instructions.

## Build Commands

```bash
# Full build (clean, compile, copy assets)
bun run build

# Development with TypeScript watch
bun run dev
```

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
├── domain/         # Domain-specific operations (reusable business logic)
│   └── transaction/ # Transaction merge operation
├── render/         # Output formatting (table, key-value, JSON)
└── cli.ts          # Main CLI entry point

test/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── fixtures/       # Test data
└── helpers/        # Test utilities
```

## Common Operations

### Adding a new CLI command

1. Add command to `src/cli.ts`
2. Implement logic in `src/commands/`
3. Add tests in `test/unit/commands/`
4. Run `bun run build` to compile
