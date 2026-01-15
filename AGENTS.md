# AGENTS.md - Bkper CLI Development Guide

## Overview

Bkper CLI is a Node.js command-line client for Bkper (financial accounting platform). The project uses TypeScript, Bun, Mocha for testing, and gts (Google TypeScript Setup) for code style enforcement.

## Build Commands

```bash
# Full build (clean, compile, copy assets)
bun run build

# Development with TypeScript watch
bun run dev

# Build and start MCP server
bun run mcp

# Development with both CLI and MCP watch
bun run dev:mcp
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
TS_NODE_PROJECT=tsconfig.test.json npx mocha --config .mocharc.json test/unit/tools/get_book.test.ts

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
import { something } from "./local-module.js";
import { namedExport } from "external-package";

// Default import
import program from "commander";

// Side-effect import (when needed)
import "./some-module.js";

// Use .js extension in imports for ESM compatibility
```

### Naming Conventions

-   **Interfaces**: PascalCase (e.g., `GetBookParams`, `GroupNode`)
-   **Functions**: camelCase (e.g., `buildHierarchicalStructure`, `loadSystemPrompt`)
-   **Variables**: camelCase (e.g., `rootGroups`, `currentMockBooks`)
-   **Constants**: SCREAMING_SNAKE_CASE for config constants, camelCase for others
-   **Files**: kebab-case.ts (e.g., `get-book.ts`, `local-auth-service.ts`)
-   **Classes**: PascalCase (e.g., `BkperMcpServer`)

### Type Safety

-   **NEVER use `as any`** - Use proper types or `unknown` with type guards
-   Use interfaces for object shapes, types for unions/primitives
-   Enable strict null checks - check for undefined/null before access
-   Use `async/await` for all asynchronous operations

### Error Handling

```typescript
// CLI tool error pattern
try {
    await someOperation();
} catch (err) {
    console.error("Error doing operation:", err);
    process.exit(1);
}

// MCP tool error pattern
try {
    const result = await operation();
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
    if (error instanceof McpError) {
        throw error;
    }
    throw new McpError(
        ErrorCode.InternalError,
        `Failed: ${error instanceof Error ? error.message : String(error)}`
    );
}
```

### Code Organization

-   **Source files**: `src/` directory
-   **Tests**: `test/unit/` and `test/integration/` directories
-   **Build output**: `lib/` directory
-   **MCP assets**: `src/mcp/` copied to `lib/mcp/` during build
-   Use named exports for functions that will be imported
-   Group related functionality in dedicated directories

### Testing Conventions

-   Use Mocha with Chai (`expect` from 'chai')
-   Test files mirror source structure: `test/unit/tools/get_book.test.ts` for `src/mcp/tools/get_book.ts`
-   Helper utilities in `test/unit/helpers/`
-   Mock data fixtures in `test/fixtures/`
-   Use `setupTestEnvironment()` and `getTestPaths(import.meta.url)` in tests

## Project Structure

```
src/
├── auth/           # Authentication services
├── commands/       # CLI command implementations
├── mcp/           # MCP server and tools
│   ├── domain/    # Domain-specific operations
│   └── tools/     # Individual MCP tool handlers
└── cli.ts         # Main CLI entry point

test/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── fixtures/      # Test data
└── helpers/       # Test utilities
```

## Common Operations

### Adding a new MCP tool

1. Create handler in `src/mcp/tools/`
2. Add to server in `src/mcp/server.ts`
3. Add tests in `test/unit/tools/`
4. Run `bun run build` to compile

### Adding a new CLI command

1. Add command to `src/cli.ts`
2. Implement logic in `src/commands/`
3. Add tests in `test/unit/commands/`
