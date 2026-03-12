# Plan: Decouple Client Tooling from CLI (Path C)

## Motivation

The `bkper app dev` and `bkper app build` commands currently bundle Vite, Miniflare, esbuild, and chokidar into a monolithic orchestrator. This creates problems:

-   **No customization** — developers can't add Vite plugins, change CSS tooling, or modify the client build
-   **Agent-unfriendly** — coding agents don't understand `bkper app dev` internals but know Vite natively
-   **Bloated CLI** — every `bkper` install ships ~90MB of dev tooling (Vite + Miniflare + esbuild) even for users who only run `bkper balance` or `bkper app deploy`
-   **Mixed concerns** — platform operations (tunnel, webhook, deploy) are entangled with build tooling (Vite, esbuild)

## Design

Split responsibilities along a clear boundary:

-   **CLI owns platform operations** — worker runtime (miniflare), worker bundling (esbuild), tunnel, webhookUrlDev, type generation, deploy
-   **Template owns client tooling** — Vite config, framework choice, client dev server, client build

Miniflare becomes an **optional peer dependency** of the CLI. The template lists it as a devDependency, satisfying the peer dep. Users who don't need local worker development never install it.

### Package-manager agnostic

All CLI error messages, template scripts, and documentation must avoid assuming a specific package manager (bun, npm, yarn, pnpm). Use bare commands where possible (`vite dev`, `bkper app dev`). For self-referencing scripts in `package.json`, use `npm run` as the universal baseline. Error messages should describe the intent ("install miniflare as a devDependency") rather than a specific command.

### Dependency changes

```
CLI (bkper) package.json:
  dependencies:     esbuild, commander, bkper-js, yaml, open, google-auth-library, openapi-fetch, tar, dotenv
  peerDependencies: miniflare ^4 (optional)
  REMOVED:          vite, chokidar

Template package.json:
  devDependencies:  vite ^7, miniflare, concurrently
```

### Command changes

| Command            | Before                                         | After                                                                          |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `bkper app dev`    | Starts Vite + Miniflare + tunnel + webhook     | Starts Miniflare (worker runtime) + esbuild watch + tunnel + webhook. No Vite. |
| `bkper app build`  | Builds client (Vite) + workers (esbuild)       | Builds workers only (esbuild). No Vite.                                        |
| `bkper app deploy` | Calls `build()` internally, uploads everything | Reads pre-built `dist/` directory, uploads. Does NOT call `build()`.           |

### Template scripts

```json
{
    "scripts": {
        "dev": "concurrently \"vite dev\" \"bkper app dev\"",
        "dev:client": "vite dev",
        "dev:server": "bkper app dev --web",
        "dev:events": "bkper app dev --events",
        "build": "vite build && bkper app build",
        "deploy": "npm run build && bkper app deploy",
        "deploy:preview": "npm run build && bkper app deploy --preview"
    }
}
```

### Template vite.config.ts (new file)

Placed at the **template root** (next to `package.json` and `bkper.yaml`) with an explicit `root` pointing to the client package. This mirrors how `bkper.yaml` declares `deployment.web.client: packages/web/client` — the same path appears in Vite config.

```typescript
import { defineConfig } from 'vite';
import { createBkperAuthMiddleware } from 'bkper/dev';

export default defineConfig({
    root: 'packages/web/client',
    plugins: [
        {
            name: 'bkper-auth',
            configureServer(server) {
                server.middlewares.use(createBkperAuthMiddleware());
            },
        },
    ],
    server: {
        proxy: { '/api': 'http://localhost:8787' },
    },
});
```

### Auth middleware export

The CLI exports a plain Connect-compatible middleware (`(req, res, next)`) from a `bkper/dev` entry point. No Vite types required. The middleware reads CLI credentials from `~/.config/bkper/.bkper-credentials.json` and handles `/auth/refresh` requests.

```json
// CLI package.json "exports" field
{
    ".": "./lib/index.js",
    "./dev": "./lib/dev/auth-middleware.js"
}
```

---

## Implementation

### Phase 1: CLI refactoring

**Ordering:** Steps should be executed in listed order (1.1 → 1.13). Key dependencies: 1.7 (remove vite.ts) must come after 1.2 and 1.3 (which remove all imports from it). 1.6 (package.json exports) should come after 1.5 (auth middleware refactor). 1.13 (tests) comes last.

#### 1.1 Dynamic miniflare import

**File: `src/dev/miniflare.ts`**

Replace static `import { Miniflare } from 'miniflare'` with a dynamic import helper:

```typescript
async function loadMiniflare() {
    try {
        return await import('miniflare');
    } catch {
        console.error('miniflare is required for local development.');
        console.error('Install it as a devDependency (e.g. npm install -D miniflare).');
        process.exit(1);
    }
}
```

All three exports (`createWorkerServer`, `reloadWorker`, `stopWorkerServer`) call this internally.

#### 1.2 Refactor `src/commands/apps/dev.ts`

Remove all Vite orchestration (~100 lines):

-   Remove imports: `ViteDevServer`, `createClientServer`, `stopClientServer`, `getServerUrl` from `../../dev/vite.js`
-   Change `import { Miniflare } from 'miniflare'` to `import type { Miniflare } from 'miniflare'` (used only for typing the `mf` variable)
-   Remove `vite` variable and all Vite server creation/shutdown logic
-   Remove `createClientServer` call and Vite-related cleanup steps
-   Remove `options.clientPort` and `options.open` usage
-   Keep: Miniflare worker creation, esbuild watch + hot reload, shared package watch/rebuild, tunnel, webhookUrlDev, graceful shutdown
-   Replace chokidar server/events watchers with esbuild `watchWorker()` (see 1.9a)
-   Replace chokidar shared watcher with `fs.watch` (see 1.9b)
-   Remove `import { watch } from 'chokidar'`

#### 1.3 Refactor `src/commands/apps/build.ts`

Remove Vite client build (~20 lines):

-   Remove import: `buildClient` from `../../dev/vite.js`
-   Remove "Build web client (Vite)" section (lines 112-121)
-   Remove `results.webClient` tracking
-   Keep: type generation, shared package build, esbuild worker bundling, size reporting

#### 1.4 Refactor `src/commands/apps/deploy.ts`

Decouple from `build()`:

-   Remove `import { build } from './build.js'` (line 8)
-   Remove `await build()` call (line 54) and its try/catch
-   Add validation: check that `dist/` exists and contains expected files before uploading
-   Clear error message if `dist/` is missing: "No build output found. Run your project's build script first (e.g. `npm run build`)."

#### 1.5 Refactor `src/dev/auth-middleware.ts`

Remove Vite type dependency:

-   Remove `import type { Connect } from 'vite'`
-   Type the middleware as `(req: IncomingMessage, res: ServerResponse, next: () => void) => void` using Node.js built-in types
-   Export `createBkperAuthMiddleware` as the public API name (renamed from `createAuthMiddleware`)

#### 1.6 Add package exports

**File: `package.json`**

Add exports field for the `bkper/dev` entry point:

```json
"exports": {
  ".": "./lib/index.js",
  "./dev": "./lib/dev/auth-middleware.js"
}
```

Move miniflare to peerDependencies:

```json
"peerDependencies": {
  "miniflare": "^4"
},
"peerDependenciesMeta": {
  "miniflare": { "optional": true }
}
```

Remove from dependencies: `vite`, `chokidar`

#### 1.7 Remove `src/dev/vite.ts`

This file becomes unnecessary — all its functionality moves to the template's `vite.config.ts` and standard `vite dev` / `vite build` commands.

#### 1.8 Refactor `src/commands/apps/register.ts`

Update `app dev` options:

-   Remove: `--cp, --client-port` (Vite's concern, configured in `vite.config.ts`)
-   Remove: `--no-open` (Vite's concern, configured in `vite.config.ts`)
-   Keep: `--sp, --server-port`, `--ep, --events-port`, `--web`, `--events`

#### 1.9a Refactor `src/dev/esbuild.ts` — add watch mode for workers

Add a `watchWorker` function using `esbuild.context()` to replace chokidar for server and events file watching:

```typescript
async function watchWorker(
    entryPoint: string,
    onRebuild: (code: string) => void
): Promise<{ dispose: () => Promise<void> }> {
    const ctx = await esbuild.context({
        ...getBaseConfig(entryPoint),
        write: false,
        sourcemap: 'inline',
        plugins: [
            workersExternalsPlugin,
            {
                name: 'notify-rebuild',
                setup(build) {
                    build.onEnd(result => {
                        if (result.errors.length === 0 && result.outputFiles?.[0]) {
                            onRebuild(result.outputFiles[0].text);
                        }
                    });
                },
            },
        ],
    });
    await ctx.watch();
    return { dispose: () => ctx.dispose() };
}
```

The `onRebuild` callback receives the bundled code string and feeds it to Miniflare. This replaces the chokidar watchers for `packages/web/server/` and `packages/events/`.

**Note:** The current `reloadWorker` in `miniflare.ts` calls `buildWorker()` internally (builds then updates Miniflare). With esbuild watch, the code is already built when the callback fires. Add a new `updateWorkerCode(mf, code)` function that accepts pre-built code, or modify `reloadWorker` to accept an optional `code` parameter that skips the build step when provided.

#### 1.9b Shared package watching — use `fs.watch`

Replace chokidar for `packages/shared/src/` with Node's built-in `fs.watch` (recursive option, stable on Node 22 across all platforms). This is lightweight and eliminates the chokidar dependency entirely.

```typescript
import { watch as fsWatch } from 'node:fs';

// In the dev startup, if packages/shared/src exists:
const sharedWatcher = fsWatch(sharedDir, { recursive: true }, (event, filename) => {
    if (filename && filename.includes('node_modules')) return;
    sharedLogger.info(`Change detected: ${filename}`);
    if (sharedDebounceTimer) clearTimeout(sharedDebounceTimer);
    sharedDebounceTimer = setTimeout(rebuildShared, 200);
});
```

The existing debounce + queue logic (`sharedBuildInProgress`, `sharedBuildPending`) stays unchanged — only the event source changes. Add `sharedWatcher.close()` to the cleanup sequence.

#### 1.10 Update `src/dev/logger.ts`

Remove `clientUrl` from the dev server startup banner. After the refactor, `bkper app dev` no longer knows the Vite URL. The banner should show:

-   Worker runtime URL (`http://localhost:8787`)
-   Tunnel URL (if events enabled)
-   Remove any Vite/client URL reference

#### 1.11 Simplify `src/dev/preflight.ts`

Remove client framework dependency checks (Lit, Vue, etc.) — these are the template's concern now. Keep: `package.json` exists, `node_modules` installed, TypeScript for shared package.

#### Checkpoint

Run the build to verify the CLI compiles without errors. All removed imports and references should be gone. The build output in `lib/` should not contain any Vite references.

#### 1.12 Update tests

Files affected:

-   `test/unit/dev/miniflare.test.ts` — update for dynamic import pattern
-   `test/unit/dev/vite.test.ts` — remove or convert to auth-middleware test
-   Any test referencing `buildClient`, `createClientServer`, or Vite integration

#### Checkpoint

Run unit tests to verify all pass with the refactored code.

### Phase 2: Template changes (`bkper/bkper-app-template`)

#### 2.1 Add `vite.config.ts` to template root

Place at the template root (next to `package.json` and `bkper.yaml`) with `root: 'packages/web/client'`. Standard Vite config with proxy and auth middleware (as shown in Design section above).

#### 2.2 Update `package.json`

Add root devDependencies: `vite ^7`, `miniflare`, `concurrently`
Move `vite` from `packages/web/client/package.json` devDependencies to root (or keep in both — root is needed for `vite dev` from root scripts).
Update scripts to the new pattern (as shown in Design section above).

#### 2.3 Update template client package

Ensure `packages/web/client/` works as a standard Vite project (it likely already does — verify `index.html` and Vite entry point).

#### Checkpoint

In the template directory, verify that the client dev script starts Vite successfully, and `bkper app dev` starts the worker runtime. Verify the build script produces the expected `dist/` output.

### Phase 3: Documentation updates

Every documentation file below needs updating to reflect the new architecture where `vite dev` and `bkper app dev` run as separate, composable commands.

**Note:** All documentation should use `npm run` as the baseline package manager command, or use generic phrasing ("run the dev script"). Avoid bun-specific or yarn-specific commands in primary examples. If showing multiple options, use a note or aside.

#### 3.1 CLI README (`/workspace/bkper-cli/README.md`)

**HIGH PRIORITY**

-   **Lines 494-517** — "Development Workflow" section:

    -   Change `bkper app dev` description to explain it runs the worker runtime, not the full stack
    -   Add `vite dev` to the workflow
    -   Show the `concurrently` pattern or separate terminal approach
    -   Update `bkper app build` to clarify it builds workers only
    -   Show full workflow: `npm run build` (vite + workers) → `bkper app deploy`

-   **Lines 783-800** — Command reference:
    -   Remove `--cp, --client-port` option
    -   Remove `--no-open` option
    -   Update `app build` description from "Build app artifacts" to "Build worker bundles"
    -   Update `app dev` description from "Run local development servers" to "Run worker runtime locally"

#### 3.2 CLI AGENTS.md (`/workspace/bkper-cli/AGENTS.md`)

-   **Lines 14-22** — "Build Commands" section: Add note about template scripts vs CLI commands

#### 3.3 Development docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/development.mdx`)

**HIGH PRIORITY — near-complete rewrite**

-   **Title/description (lines 1-3)**: Remove "Vite HMR" from description (Vite is template's concern)
-   **Lines 6-19** — "What it starts": Rewrite to reflect split architecture:
    -   `bkper app dev` starts: Miniflare (worker runtime), file watcher (auto-rebuild), tunnel (events), webhookUrlDev
    -   `vite dev` starts: client dev server with HMR
    -   Template's `npm run dev` runs both via `concurrently`
-   **Lines 30-46** — Configuration flags: Remove `--cp` and `--no-open`
-   **Lines 79-87** — Type generation: Change `bkper app build` to `bkper app types` or keep as-is if build still generates types
-   **Lines 89-96** — Development loop: Update to mention two processes (Vite + bkper)
-   **Lines 98-102** — Debugging: Update client debugging to reference standard Vite (not CLI-managed Vite)

#### 3.4 Deploying docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/deploying.mdx`)

**HIGH PRIORITY**

-   **Lines 10-23** — Build step: Rewrite to show `npm run build` (which runs `vite build && bkper app build`) instead of standalone `bkper app build` doing everything
-   **Lines 33-41** — Deploy step: Note that deploy no longer builds internally; `dist/` must be pre-built
-   **Lines 43-47** — Typical workflow: Update to `npm run build && bkper app sync && bkper app deploy`

#### 3.5 First app tutorial (`/workspace/bkper-mkt/web/docs/src/content/docs/build/getting-started/first-app.mdx`)

**HIGH PRIORITY**

-   **Lines 37-40** — Template structure: Mention `vite.config.ts` as a new file
-   **Lines 77-94** — "Start developing":
    -   Change from `bkper app dev` to `npm run dev` (which runs both)
    -   Update the "what starts" list to explain the two-process architecture
    -   Update terminal output example
-   **Lines 164-179** — "Deploy to production":
    -   Change from `bkper app deploy` (which built internally) to `npm run deploy` (which builds then deploys)
    -   Update output example

#### 3.6 Architecture docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/architecture.mdx`)

**MEDIUM PRIORITY**

-   **Line 3** — Description: Keep "Lit + Vite" reference (still true, just not CLI-managed)
-   **Lines 14, 25** — Vite references: These are accurate (Vite is still used), just update to clarify it's configured in the template's `vite.config.ts`, not the CLI

#### 3.7 CLI tools docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/tools/cli.mdx`)

**MEDIUM PRIORITY**

-   **Lines 59-82** — Developer workflows:
    -   Update `bkper app dev` comment from "(Vite + Workers + tunnel)" to "(Workers runtime + tunnel)"
    -   Update `bkper app build` comment from "Build for production" to "Build worker bundles"
    -   Add note about `npm run dev` / `npm run build` as the full workflow

#### 3.8 Overview docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/overview.mdx`)

**MEDIUM PRIORITY**

-   **Lines 29-35** — Developer experience description: Update to reflect the composable two-process approach

#### 3.9 Authentication docs (`/workspace/bkper-mkt/web/docs/src/content/docs/build/concepts/authentication.mdx`)

**LOW PRIORITY**

-   **Line 94** — Note about `bkper app dev` handling OAuth: Update to explain the auth middleware in `vite.config.ts` handles this

#### 3.10 Template README (`/workspace/bkper-app-template/README.md`)

**HIGH PRIORITY**

-   **Lines 7-12** — Quick start: Change `bkper app dev` to `npm run dev`
-   **Lines 38-48** — Development section:
    -   Replace "This single command" with explanation of `npm run dev` running Vite + bkper concurrently
    -   Mention `vite.config.ts` as the client configuration
-   **Lines 50-56** — Deploy section: Change `bkper app deploy` to `npm run deploy`
-   Add section about `vite.config.ts` customization (adding plugins, etc.)

#### 3.11 Template AGENTS.md (`/workspace/bkper-app-template/AGENTS.md`)

**HIGH PRIORITY**

-   **Lines 29-46** — Development workflow:
    -   Update `bkper app dev` → `npm run dev`
    -   Explain two-process architecture
    -   Mention `vite.config.ts` for client customization
-   **Lines 48-76** — Building and deploying:
    -   Update `bkper app build` → `npm run build`
    -   Clarify Vite builds client, esbuild builds workers
    -   Update `bkper app deploy` → `npm run deploy`
-   **Lines 132-138** — Adding secrets: Update `bkper app build` reference for type regeneration

---

## Resolved decisions

1. **Deploy: fully decoupled.** `bkper app deploy` only uploads — it reads `dist/` and sends to the platform. It does not build anything. If `dist/` is missing, it exits with a clear error: "No build output found. Run your project's build script first." The template's deploy script composes the full pipeline: `npm run build && bkper app sync && bkper app deploy`. This is consistent with how `wrangler deploy` works post-Cloudflare migration. Each command does one thing.

2. **Type generation stays in `build`.** `bkper app build` continues generating `env.d.ts` as a side effect — it already reads `bkper.yaml` to know what to build, so generating types is nearly free. `bkper app dev` also generates types on startup. No separate `bkper app types` command needed unless there's demand later.

3. **Events-only apps**: The template provides separate scripts (`dev:client`, `dev:server`, `dev:events`). Events-only apps remove the `vite dev` portion from the main `dev` script, or just use `npm run dev:events` directly.

4. **Package-manager agnostic.** CLI error messages describe intent ("install miniflare as a devDependency") rather than specific commands. Template `package.json` scripts use `npm run` for self-references. Documentation uses `npm run` as baseline or generic phrasing.

---

## Files inventory

### CLI files to modify

-   `src/commands/apps/dev.ts` — Remove Vite orchestration, replace chokidar with esbuild watch + fs.watch
-   `src/commands/apps/build.ts` — Remove Vite client build
-   `src/commands/apps/deploy.ts` — Remove internal `build()` call
-   `src/commands/apps/register.ts` — Remove client-port, no-open options
-   `src/dev/miniflare.ts` — Dynamic import, add `updateWorkerCode` for pre-built code
-   `src/dev/auth-middleware.ts` — Remove Vite type dep, rename export
-   `src/dev/esbuild.ts` — Add `watchWorker` function
-   `src/dev/preflight.ts` — Remove client checks
-   `src/dev/logger.ts` — Remove clientUrl from startup banner
-   `package.json` — Dependencies, exports, peerDependencies

### CLI files to remove

-   `src/dev/vite.ts` — Replaced by template's vite.config.ts

### Template files to modify

-   `package.json` — Scripts, devDependencies (add vite ^7, miniflare, concurrently)
-   `packages/web/client/package.json` — Review vite dependency (may move to root)
-   `README.md` — Workflow documentation
-   `AGENTS.md` — Development instructions

### Template files to create

-   `vite.config.ts` — Client dev server and build config (at template root, with `root: 'packages/web/client'`)

### Documentation files to update

-   `/workspace/bkper-cli/README.md` — Dev workflow, command reference
-   `/workspace/bkper-cli/AGENTS.md` — Build commands
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/development.mdx` — Near-complete rewrite
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/deploying.mdx` — Build/deploy steps
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/getting-started/first-app.mdx` — Tutorial workflow
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/architecture.mdx` — Vite references
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/tools/cli.mdx` — CLI workflow section
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/apps/overview.mdx` — DX description
-   `/workspace/bkper-mkt/web/docs/src/content/docs/build/concepts/authentication.mdx` — Auth note
