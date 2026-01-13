# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is the Bkper Node.js command line client - a CLI tool for creating and updating Bkper Apps and Bots. It's built in TypeScript and compiled to ES modules.

## Key Commands

### Build and Development
- `bun run build` - Full build (clean + compile TypeScript)
- `bun run dev` - Development mode with TypeScript watch
- `bun run build:clean` - Clean build artifacts using gts
- `bun run build:compile` - Compile TypeScript only

### Testing
- `bun run test` - Run all tests with Mocha
- `test/` - Test directory with simple JavaScript tests for TDD
- ALWAYS run the `bun run test` command when asked to run tests.

### Package Management
- `bun install` - Install dependencies (used automatically in prebuild)
- `bun run upgrade:api` - Update Bkper API types and bkper-js to latest versions

### Versioning and Publishing
- `bun run patch/minor/major` - Version bump and publish workflow

## Architecture

### Project Structure
- `src/` - TypeScript source code
  - `cli.ts` - Main CLI entry point with Commander.js commands
  - `index.ts` - Library export (only exports getOAuthToken function)
  - `auth/local-auth-service.ts` - OAuth authentication handling
  - `mcp/server.ts` - MCP server implementation
- `lib/` - Compiled JavaScript output (ES modules with source maps)
- `test/` - Test files for TDD development
  - `fixtures/` - Test data fixtures
  - `mcp-server.test.js` - MCP tool tests

### Core Components

#### CLI Commands (`src/cli.ts`)
- `login` - Authenticate with Bkper and store credentials
- `logout` - Remove stored credentials
- `app -c/-u` - Create or update Bkper apps based on bkperapp.yaml/json config
- `mcp` - Start Bkper MCP server for Model Context Protocol integration

#### Authentication (`src/auth/local-auth-service.ts`)
- Uses Google OAuth2 with local auth flow
- Stores credentials in `~/.config/bkper/.bkper-credentials.json`
- Requires `keys.json` file for OAuth client configuration
- Main export: `getOAuthToken()` function for bkper-js integration

#### Configuration
- Apps are configured via `bkperapp.yaml` or `bkperapp.json` files
- Environment variables:
  - `BKPER_API_KEY` - (Optional) API key for direct API access. If not set, uses the API proxy.
  - `BKPER_CLIENT_SECRET` - App operations
  - `BKPER_DEVELOPER_EMAIL` - Developer identification
  - `BKPER_USER_EMAILS` - User permissions
  - `TEST_BOOK_ID` - Fixed book ID for consistent integration testing

#### API Access Modes
The CLI supports two modes of API access:

1. **Proxy Mode (Default)**: When `BKPER_API_KEY` is not set, requests go through
   `https://api.bkper.app` which injects a managed API key. This is the simplest
   setup - users only need to run `bkper login`.

2. **Direct Mode**: When `BKPER_API_KEY` is set, requests go directly to the Bkper
   API. This is for power users who want their own API dashboard, quotas, and attribution.

### Dependencies
- `bkper-js` - Core Bkper API client library
- `commander` - CLI framework
- `@google-cloud/local-auth` - Google OAuth authentication
- `yaml` - YAML configuration parsing
- `@modelcontextprotocol/sdk` - MCP server implementation
- `mocha` + `chai` - Testing framework for TDD

### Bkper-JS Library Usage

#### Authentication & Initialization
```typescript
import { App, Bkper } from 'bkper-js';
import { getOAuthToken } from './auth/local-auth-service.js';

// Configure Bkper - uses proxy when no API key is set
const apiKey = process.env.BKPER_API_KEY;
Bkper.setConfig({
  apiKeyProvider: apiKey ? async () => apiKey : undefined,
  oauthTokenProvider: () => getOAuthToken(),
  apiBaseUrl: apiKey ? undefined : 'https://api.bkper.app'
});
```

#### Key Concepts
- **Apps**: Bkper applications/bots that extend functionality
- **Books**: Top-level containers for accounting data (like individual company ledgers)
- **Accounts**: Categories within books (ASSETS, LIABILITIES, INCOMING, OUTGOING)
- **Groups**: Hierarchical organization of accounts (Current Assets, Operating Expenses, etc.)
- **Transactions**: Financial entries that move money between accounts
- **Collections**: Groups of related books for multi-currency/multi-entity operations

#### Common Usage Patterns
```typescript
// Create/Update Apps (from CLI implementation)
const appConfig = JSON.parse(fs.readFileSync('./bkperapp.json', 'utf8'));
const app = new App(appConfig)
  .setReadme(fs.readFileSync('./README.md', 'utf8'))
  .setClientSecret(process.env.BKPER_CLIENT_SECRET)
  .setDeveloperEmail(process.env.BKPER_DEVELOPER_EMAIL)
  .setUserEmails(process.env.BKPER_USER_EMAILS);

// Create or update the app
const createdApp = await app.create();
const updatedApp = await app.update();
```

#### Authentication Flow
The `getOAuthToken()` function from `local-auth-service.ts` handles:
1. Google OAuth2 flow with local authentication
2. Credential storage in `~/.config/bkper/.bkper-credentials.json`
3. Token refresh and management
4. Returns valid access tokens for Bkper API calls

#### TypeScript Types Reference
**IMPORTANT**: When writing code that uses bkper-js, you MUST refer to and respect the official TypeScript type definitions. These provide the authoritative interface contracts for all classes and methods.

- **bkper-js Types**: https://raw.githubusercontent.com/bkper/bkper-js/refs/heads/main/lib/index.d.ts
- **bkper-api-types**: https://raw.githubusercontent.com/bkper/bkper-api-types/master/index.d.ts

Key principles:
- Always use the exact method signatures defined in the TypeScript types
- Respect the enum values (AccountType, Permission, Visibility)
- Follow the proper class hierarchy (Bkper → Book → Account/Transaction)
- Use the correct property names and types as defined in the interfaces
- **For implementation**: Use the high-level bkper-js library wrapper for auth and endpoints



// Get books using high-level wrapper
```typescript
const books = await Bkper.getBooks();
// Return raw API format (bkper.Book[]) for MCP response
return books.map(book => book.json()); // Should match bkper-api-types bkper.Book interface
```

##### Local Testing Strategy
```bash
# Start MCP server locally
bun run build && node lib/cli.js mcp start

# Test with MCP client or manual protocol testing
# (Implementation details to be determined during development)
```

#### External Resources
- [bkper-js GitHub Repository](https://github.com/bkper/bkper-js)
- [Bkper API Documentation](https://help.bkper.com/en/articles/4208937-bkper-api-reference)
- [Bkper Developer Hub](https://developers.bkper.com/)
- Example bot implementations:
  - [Tax Bot](https://github.com/bkper/bkper-tax-bot)
  - [Exchange Bot](https://github.com/bkper/bkper-exchange-bot)
  - [Portfolio Bot](https://github.com/bkper/bkper-portfolio-bot)

### TypeScript Configuration
- Extends Google TypeScript style (gts)
- Compiles to ES2015 with ES modules
- Generates declaration files and source maps
- Custom type roots include `@bkper` types
- **NEVER use `as any`** - Always use proper type casting or type guards
    - Prefer type assertions with specific interfaces
    - Use type guards to narrow down types safely
    - If a type is not correctly inferred, fix the type definition or add proper type annotations

## Development Notes
- Uses Bun as package manager and runtime
- ES modules throughout (type: "module" in package.json)
- Google TypeScript Style (gts) for linting and formatting
- **NEVER modify any files inside `node_modules/` directory** - these are managed dependencies

## Code Commit Guidelines
- Never commit code automatically after implementing a feature or a test.

## Test-Driven Development (TDD) Workflow

  - **IMPORTANT**: ALWAYS plan a new feature or improvement using TDD approach
  - The plan should always be split in two phases:
    1. First phase: Add or modify tests
       - Write comprehensive test cases
       - Review and validate tests
       - Commit tests manually for review
    2. Second phase: Implementation
       - Implement code to pass the tests
       - Review implementation
       - Ensure all tests pass
       - Refactor if necessary
  - **IMPORTANT**: NEVER move to the second phase automatically. Wait me to review the tests and commit them manually.

### Running Tests
```bash
bun run test                    # Run all tests
bun run test:unit              # Run unit tests only (mocked)
bun run test:integration       # Run integration tests (real API)
```

### Test Structure
- **Unit Tests** (`test/unit/`):
  - **Mocking strategy**: Mock `bkper-js` and `local-auth-service` dependencies
  - **Fixtures**: Use `test/fixtures/` for sample data (e.g., `sample-books.json`)
  - **Focus on logic**: Test core functionality without external dependencies

- **Integration Tests** (`test/integration/`):
  - **Real API calls**: Uses actual Bkper API with `TEST_BOOK_ID`
  - **Fixed book testing**: All integration tests use the same book ID for consistency
  - **30-second timeout**: Generous timeout for network operations
  - **Retry logic**: Built-in retry for network reliability

### Adding New MCP Tool Tests
1. Create test data in `test/fixtures/`
2. Add test cases in `test/mcp-server.test.js`
3. Mock any external dependencies (Bkper API, auth)
4. Test the core business logic and response format
5. Ensure MCP protocol compliance

### Example Test Pattern
```javascript
it('should handle new_tool correctly', async function() {
  // Arrange: Set up test data and mocks
  const mockData = require('./fixtures/sample-data.json');
  
  // Act: Execute the logic being tested
  const result = await toolLogic(mockData);
  
  // Assert: Verify expected behavior
  expect(result).to.have.property('expectedField');
});
```

