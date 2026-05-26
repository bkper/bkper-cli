# Apps (Full)

---
source: /docs/build/apps/app-listing.md

# App Listing

All Bkper apps are listed on the Automations Portal at _[app.bkper.com](https://app.bkper.com/) > Automations > Apps_. Each app has its own page with logo, description, and details:

![App listing on the Automations Portal](https://bkper.com/docs/_astro/bkper-app-listing.BgcbAsjE.png)

App listings are populated from the fields you declare in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md). Sync metadata changes with `bkper app sync`. Deploying code is a separate step.

## Listing fields

Make sure your `bkper.yaml` has the following fields populated for a complete listing:

```yaml
id: your-app-id
name: Your App Name
description: A clear description of what your app does

logoUrl: https://your-app.bkper.app/images/logo.svg
logoUrlDark: https://your-app.bkper.app/images/logo-dark.svg

ownerName: Your Name or Organization
ownerWebsite: https://yourwebsite.com

website: https://your-app.bkper.app
```

See [App Configuration](https://bkper.com/docs/build/apps/configuration.md) for the full `bkper.yaml` reference.

## Default visibility

By default, installation is limited to the users you've declared in `bkper.yaml`:

```yaml
# Specific Bkper usernames
users: alice bob

# Your entire domain
users: *@yourcompany.com
```

Use Bkper usernames for individual access, not email addresses.

Your team can install and use the app, but it doesn't appear in the public Bkper app directory for other users.

## Publishing to all users

To make your app available to all Bkper users, contact us at [support@bkper.com](mailto:support@bkper.com?subject=Publish+Bkper+App). We'll review your app and, once approved, publish it.

### What the review involves

- **Functionality check** — The app works correctly and handles errors gracefully
- **Security review** — Event handlers are idempotent and include loop prevention
- **Listing quality** — The app has a clear name, description, logo, and user-facing documentation

### README matters

Your app's `README.md` is displayed to end users on the app listing page. Write it for the people who will install and use your app — not for developers.

**README should explain:**
- What the app does from a user's perspective
- How to use it (step-by-step for non-technical users)
- What features are available

**README should NOT contain:**
- Tech stack or architecture details
- Build commands or development setup
- Project structure or internal file paths
- API documentation or SDK references

Put developer documentation in `AGENTS.md` or internal docs instead. Keep `README.md` focused on the user experience.

### Where published apps appear

Once published, your app appears in:

- **[bkper.com/apps](https://bkper.com/apps)** — The public app directory
- **Automations Portal** — Inside every Bkper book, users can find and install your app

---
source: /docs/build/apps/architecture.md

# App Architecture

Bkper platform apps follow a three-package monorepo pattern. Each package handles a distinct concern, all deployed to the same `{appId}.bkper.app` domain.

## Structure

```
packages/
├── shared/     — Shared types and utilities
├── web/
│   ├── client/ — Frontend UI (Vite + Lit)
│   └── server/ — Backend API (Hono)
└── events/     — Event handler (webhooks)
```

The packages are connected via [Bun workspaces](https://bun.sh/docs/install/workspaces). Import shared code from `@my-app/shared` in any package.

## Web client

The client package builds a browser UI with [Lit](https://lit.dev/) and [@bkper/web-design](https://www.npmjs.com/package/@bkper/web-design) for consistent Bkper styling.

- Built with [Vite](https://vitejs.dev/) — configured in the project's `vite.config.ts` for fast builds and HMR during development
- Static assets served by the web server handler
- Communicates with Bkper via `bkper-js`

This is where your app's UI lives — book pickers, account lists, reports, forms.

### Web client authentication

The client authenticates users via the [`@bkper/web-auth`](https://www.npmjs.com/package/@bkper/web-auth) SDK. OAuth is pre-configured on the platform — no client IDs, redirect URIs, or consent screens to set up.

```ts
import { Bkper } from 'bkper-js';
import { BkperAuth } from '@bkper/web-auth';

const auth = new BkperAuth({
    baseUrl: isLocalDev ? window.location.origin : undefined,
    onLoginSuccess: () => initializeApp(),
    onLoginRequired: () => showLoginButton(),
});
await auth.init();

const bkper = new Bkper({
    oauthTokenProvider: async () => auth.getAccessToken(),
});
```

This is the canonical pattern. Do not implement custom OAuth flows, redirect handling, or token refresh — the SDK and platform handle everything. See the [@bkper/web-auth API Reference](https://bkper.com/docs/api/bkper-web-auth.md) for the full SDK documentation.

## Web server

The server package runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) using [Hono](https://hono.dev/) as the web framework. It handles:

- Serving the client's static assets
- Custom API routes for your app's backend logic
- Type-safe access to platform services (KV, secrets) via `c.env`

```ts
import { Hono } from 'hono';
import type { Env } from '../../../../env.js';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/data', async c => {
    const cached = await c.env.KV.get('my-key');
    return c.json({ data: cached });
});

export default app;
```

### Server API authentication

For deployed apps, server API routes under `/api/*` require a standard bearer token on the incoming request:

```ts
const token = auth.getAccessToken();
if (!token) throw new Error('Not authenticated');

const response = await fetch('/api/data', {
    headers: { Authorization: `Bearer ${token}` },
});
```

Dispatch validates the bearer token before your Worker runs. It then strips the `Authorization` header and passes only an internal outbound context, so app code should not read user tokens from request headers.

When the server route calls Bkper, use `bkper-js` without a token provider:

```ts
import { Bkper } from 'bkper-js';

app.get('/api/books', async c => {
    const bkper = new Bkper();
    const books = await bkper.getBooks();
    return c.json({
        books: books.map(book => ({
            id: book.getId(),
            name: book.getName(),
        })),
    });
});
```

Platform outbound auth injects the validated user's OAuth token on exact Bkper API requests. Browser sessions only allow access to app web pages; they do not authorize `/api/*` server routes or create outbound auth context.

## Events handler

The events package receives webhook calls from Bkper when subscribed [events](https://bkper.com/docs/build/apps/event-handlers.md) occur. It's a separate Hono app that processes events and returns responses.

```ts
import { Hono } from 'hono';
import { Bkper, Book } from 'bkper-js';
import { handleTransactionChecked } from './handlers/transaction-checked.js';
import type { Env } from '../../../env.js';

const app = new Hono<{ Bindings: Env }>().basePath('/events');

app.post('/', async c => {
    const event: bkper.Event = await c.req.json();

    if (!event.book) {
        return c.json({ error: 'Missing book in event payload' }, 400);
    }

    const bkper = new Bkper({
        oauthTokenProvider: async () => c.req.header('bkper-oauth-token'),
        agentIdProvider: async () => c.req.header('bkper-agent-id'),
    });
    const book = new Book(event.book, bkper.getConfig());

    switch (event.type) {
        case 'TRANSACTION_CHECKED':
            return c.json(await handleTransactionChecked(book, event));
        default:
            return c.json({ result: false });
    }
});

export default app;
```

Event handlers run at `https://{appId}.bkper.app/events` in production. During development, a Cloudflare tunnel routes events to your local machine.

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for patterns and details.

## Shared package

Common types, utilities, and constants used across packages:

```ts
// packages/shared/src/types.ts
export interface EventResult {
    result?: string | string[] | boolean;
    error?: string;
    warning?: string;
}

// packages/shared/src/constants.ts
export const APP_NAME = 'my-app';
```

Import in any package:

```ts
import type { EventResult } from '@my-app/shared';
```

> **Note:** The `Env` type (KV bindings, secrets) lives in the root `env.d.ts` file, auto-generated from `bkper.yaml`. Import it as `import type { Env } from '../../../env.js'` — it is not part of the shared package.

## When you don't need all three

Not every app needs a UI, API, and event handler:

- **Event-only app** — Just the `events` package. Automates reactions to book events without a user interface. Remove the `web` section from `bkper.yaml`.
- **UI-only app** — Just the `web` packages. Opens via a [context menu](https://bkper.com/docs/build/apps/context-menu.md) to display data or collect input. Remove the `events` section from `bkper.yaml`.
- **Full app** — All three packages. Interactive UI with backend logic and event-driven automation.

The template includes all three by default. Remove what you don't need.

## Simple App Patterns

These are the minimal, canonical patterns for common app tasks. Use them as starting points and resist adding complexity unless the user explicitly asks for it.

### Client-only UI with authentication

The smallest useful app needs only the `packages/web/client/` directory. No server routes, no event handlers, no custom auth logic.

```ts
// packages/web/client/src/app.ts
import { Bkper } from 'bkper-js';
import { BkperAuth } from '@bkper/web-auth';

const auth = new BkperAuth({
    baseUrl: window.location.origin.includes('localhost') ? undefined : window.location.origin,
    onLoginSuccess: () => render(),
    onLoginRequired: () => renderLogin(),
});
await auth.init();

const bkper = new Bkper({
    oauthTokenProvider: async () => auth.getAccessToken(),
});

async function render() {
    const books = await bkper.getBooks();
    // render books
}
```

Key points:
- `BkperAuth` handles OAuth, token refresh, and session management internally.
- `auth.getAccessToken()` returns a valid token synchronously after `init()` resolves.
- Do not add server-side `/auth/*` routes. Do not implement `refresh_token` logic yourself.

### Fetch and display data

```ts
const book = await bkper.getBook(bookId);
const accounts = await book.getAccounts();
// render accounts
```

Use `bkper-js` for all API calls. Do not call the REST API directly when `bkper-js` provides the same method.

## Library Usage Reference

| Task | Use | Do not use |
|------|-----|------------|
| Client authentication | `@bkper/web-auth` (`BkperAuth`, `getAccessToken`) | Custom OAuth flows, manual `fetch('/auth/refresh')`, `google-auth-library` in the browser |
| API calls from client | `bkper-js` (`Bkper`, `Book`, `Account`, `Transaction`) | Direct `fetch()` to REST endpoints |
| API calls from app server `/api/*` route | Incoming `Authorization: Bearer <token>` + server-side `new Bkper()` | Reading OAuth tokens in server code, relying on browser sessions for API auth |
| API calls from event handler | `bkper-js` with `oauthTokenProvider` from `bkper-oauth-token` header | Hard-coding API keys, calling REST directly |
| Local development server | `npm run dev` (template script) | Manual `miniflare` + `cloudflared` invocations |
| Event handler routing | `switch (event.type)` in `packages/events/src/index.ts` | Middleware frameworks, external webhook routers |
| UI components | `@bkper/web-design` + Lit | Heavy UI frameworks unless the user explicitly requests them |

## Common Pitfalls

Avoid these patterns even if they seem necessary. The platform or SDK already solves the problem.

1. **Implementing custom OAuth on the server**
   - `@bkper/web-auth` manages the full OAuth lifecycle on the client. The platform handles tokens. Adding a server-side auth layer is unnecessary and will break.

2. **Adding `/api/auth/refresh` or similar routes**
   - Token refresh is internal to `@bkper/web-auth`. Exposing it via Hono routes creates security surface area and duplicates platform functionality.

3. **Relying on browser sessions for server API auth**
   - Sessions let users open app web pages, but `/api/*` routes require `Authorization: Bearer <token>`. Dispatch validates bearer tokens and platform outbound uses that validated context for Bkper API calls.

4. **Modifying `packages/web/server/` for a simple UI task**
   - If the user only asked for a client-side feature, do not touch the server package. The Vite dev server proxies `/api` to the Miniflare worker automatically; you do not need to add routes unless the user explicitly asks for custom backend logic.

5. **Installing additional auth or HTTP libraries**
   - `bkper-js` and `@bkper/web-auth` are the only packages you need for Bkper API access and authentication. Adding `axios`, `google-auth-library`, or similar is almost always wrong.

6. **Creating event handlers when the user asked for a UI-only feature**
   - If the user says "show me a list of books in a popup," that is a client-only task. Do not scaffold `packages/events/` handlers or subscribe to webhooks.

7. **Calling REST endpoints directly when `bkper-js` has the method**
   - If `bkper-js` exposes `book.getTransactions()`, use it. Do not `fetch('https://api.bkper.com/...')` and parse JSON manually.

8. **Reverse-engineering SDK internals**
   - Use the public API surface documented in the API reference. Do not read SDK source to find private methods or internal request patterns.

---
source: /docs/build/apps/configuration.md

# App Configuration

The `bkper.yaml` file is the single configuration file for your Bkper app. It defines the app's identity, access control, menu integration, event handling, and deployment settings.

It lives in the root of your project. Use `bkper app sync` to push metadata changes to Bkper, and use `bkper app deploy` to upload built code to the platform.

## Minimal example

```yaml
id: my-app
name: My App
description: A Bkper app that does something useful
developers: myuser
```

## Full example

From the [app template](https://github.com/bkper/bkper-app-template):

```yaml
id: my-app
name: My App
description: A Bkper app that does something useful

logoUrl: https://my-app.bkper.app/images/logo-light.svg
logoUrlDark: https://my-app.bkper.app/images/logo-dark.svg

website: https://bkper.com/apps/bkper-cli
ownerName: Bkper
ownerLogoUrl: https://avatars.githubusercontent.com/u/11943086?v=4
ownerWebsite: https://bkper.com

repoUrl: https://github.com/bkper/bkper-app-template
repoPrivate: true

developers: someuser *@yoursite.com
users: someuser *@yoursite.com

menuUrl: https://my-app.bkper.app?bookId=${book.id}
menuUrlDev: http://localhost:8787?bookId=${book.id}

webhookUrl: https://my-app.bkper.app/events
apiVersion: v5
events:
    - TRANSACTION_CHECKED

deployment:
    web:
        main: packages/web/server/src/index.ts
        client: packages/web/client
    events:
        main: packages/events/src/index.ts
    services:
        - KV
    compatibility_date: '2026-01-28'
```

### App identity

| Field         | Description                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `id`          | Permanent app identifier. Lowercase letters, numbers, and hyphens only. Cannot be changed after creation. |
| `name`        | Display name shown in the Bkper UI.                                                                       |
| `description` | Brief description of what the app does.                                                                   |

### Branding

| Field         | Description                                |
| ------------- | ------------------------------------------ |
| `logoUrl`     | App logo for light mode (SVG recommended). |
| `logoUrlDark` | App logo for dark mode.                    |
| `website`     | App website or documentation URL.          |

### Ownership

| Field          | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `ownerName`    | Developer or company name.                                   |
| `ownerLogoUrl` | Owner's logo/avatar URL.                                     |
| `ownerWebsite` | Owner's website.                                             |
| `repoUrl`      | Source code repository URL.                                  |
| `repoPrivate`  | Whether the repository is private.                           |
| `deprecated`   | Hides from app listings; existing installs continue working. |

### Access control

| Field        | Description                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `developers` | Who can update the app and deploy new versions. Comma-separated Bkper usernames. Supports domain wildcards: `*@yoursite.com`. |
| `users`      | Who can install and use the app. Same format as developers. Leave empty for public apps.                                      |

### Menu integration

| Field             | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `menuUrl`         | Production menu URL. Supports [variable substitution](#menu-url-variables). |
| `menuUrlDev`      | Development menu URL (used when the developer clicks the menu).             |
| `menuText`        | Custom menu text (defaults to app name).                                    |
| `menuOpenMode`    | How the app menu opens: `SIDEBAR` (default), `EXPANDED`, or `NEW_TAB`.      |

See [Context Menu](https://bkper.com/docs/build/apps/context-menu.md) for details on building menu integrations.

### Menu URL variables

The following variables can be used in `menuUrl` and `menuUrlDev`:

| Variable                    | Description                              |
| --------------------------- | ---------------------------------------- |
| `${book.id}`                | Current book ID                          |
| `${book.properties.xxx}`    | Book property value                      |
| `${account.id}`             | Selected account ID                      |
| `${account.name}`           | Selected account name                    |
| `${account.properties.xxx}` | Account property value                   |
| `${group.id}`               | Selected group ID                        |
| `${group.name}`             | Selected group name                      |
| `${group.properties.xxx}`   | Group property value                     |
| `${transactions.ids}`       | Comma-separated selected transaction IDs |
| `${transactions.query}`     | Current search query                     |

### Event handling

| Field           | Description                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| `webhookUrl`    | Production webhook URL for receiving events.                                    |
| `webhookUrlDev` | Development webhook URL (auto-updated by `bkper app dev`).                      |
| `apiVersion`    | API version for event payloads (currently `v5`).                                |
| `events`        | List of [event types](https://bkper.com/docs/build/apps/event-handlers.md#event-types) to subscribe to. |

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for details on handling events.

### File patterns

| Field          | Description                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `filePatterns` | List of glob patterns (e.g., `*.ofx`, `*.csv`). When a matching file is uploaded, a `FILE_CREATED` event is triggered. |

### Properties schema

The `propertiesSchema` field defines autocomplete suggestions for custom properties in the Bkper UI, helping users discover the correct property keys and values for your app:

```yaml
propertiesSchema:
    book:
        keys:
            - my_app_enabled
        values:
            - 'true'
            - 'false'
    group:
        keys:
            - my_app_category
    account:
        keys:
            - my_app_sync_id
    transaction:
        keys:
            - my_app_reference
```

### Deployment

For apps deployed to the [Bkper Platform](https://bkper.com/docs/build/apps/overview.md):

| Field                           | Description                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `deployment.web.main`           | Entry point for the web handler (serves UI and API).                                                                   |
| `deployment.web.client`         | Directory for static client assets.                                                                                    |
| `deployment.events.main`        | Entry point for the events handler (processes webhooks).                                                               |
| `deployment.services`           | Platform services to provision. Currently: `KV` (key-value storage).                                                   |
| `deployment.secrets`            | Secret names used by the app. Managed via `bkper app secrets`.                                                         |
| `deployment.compatibility_date` | [Cloudflare Workers compatibility date](https://developers.cloudflare.com/workers/configuration/compatibility-dates/). |

See [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) for the full deployment workflow.

---
source: /docs/build/apps/context-menu.md

# Context Menu

Apps can add context menu items on the Transactions page **More** menu in your Books. This lets you open dynamically built URLs with reference to the current Book's context — the active query, selected account, date range, and more.

## How it works

Once you install an App with a menu configuration, a new menu item appears in your Book:

![Custom menu item in the More menu](https://bkper.com/docs/_astro/bkper-report-menu.eu_pyhWe.png)

When clicked, a popup opens carrying the particular context of that book at that moment:

![App menu popup with book context](https://bkper.com/docs/_astro/bkper-app-menu-popup.BQ95Y-ki.png)

## Configuration

Configure the menu URL in your [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md):

```yaml
menuUrl: https://my-app.bkper.app?bookId=${book.id}&query=${transactions.query}
```

When the user clicks the menu item, the URL expressions `${xxxx}` are replaced with contextual information from the Book:

```
https://my-app.bkper.app?bookId=abc123&query=account:Sales
```

Where `abc123` is the current Book id and `account:Sales` is the current query being executed.

### Development URL

Use `menuUrlDev` for a separate URL during development:

```yaml
menuUrl: https://my-app.bkper.app?bookId=${book.id}&query=${transactions.query}
menuUrlDev: http://localhost:8787?bookId=${book.id}&query=${transactions.query}
```

The development URL is used when the app developer is the one clicking the menu item.

### Menu open mode

Control how the menu opens with `menuOpenMode`:

```yaml
menuOpenMode: SIDEBAR
```

| Mode       | Behavior                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| `SIDEBAR`  | Opens in a narrow side panel (default).                                   |
| `EXPANDED` | Opens in a wider panel with more room for complex UIs.                    |
| `NEW_TAB`  | Opens the menu URL in a new browser tab instead of an embedded panel.     |

### Available expressions

The menu URL supports these dynamic expressions:

| Expression | Description |
| --- | --- |
| `${book.id}` | The current Book ID |
| `${transactions.query}` | The current query string |
| `${account.id}` | The selected account ID |
| `${account.name}` | The selected account name |
| `${group.id}` | The selected group ID |
| `${group.name}` | The selected group name |

For the full list of accepted expressions, see the [Menu URL variables](https://bkper.com/docs/build/apps/configuration.md#menu-url-variables) reference.

---
source: /docs/build/apps/deploying.md

# Building & Deploying

## The deployment workflow

1. **Build** — Compile your code

   ```bash
   npm run build
   ```

   This runs two build steps:
   - Client (Vite) to static assets in `dist/web/client/`
   - Worker bundles (esbuild) — web server to `dist/web/server/`, events handler to `dist/events/`

   Build output includes size reporting so you can monitor bundle sizes.

2. **Sync** — Update app metadata

   ```bash
   bkper app sync
   ```

   Syncs your `bkper.yaml` configuration to Bkper — name, description, menu URLs, webhook URLs, access control, and branding. Run this whenever you change app settings.

3. **Deploy** — Upload code to the platform

   ```bash
   bkper app deploy
   ```

   Deploys your pre-built code from `dist/` to the Bkper Platform. Your app is live at `https://{appId}.bkper.app`.

The typical workflow combines all three:

```bash
npm run build && bkper app sync && bkper app deploy
```

### Production

The default deployment target. Your app runs at `https://{appId}.bkper.app`.

```bash
bkper app deploy
```

### Preview

Deploy to a separate preview environment for testing before production:

```bash
bkper app deploy --preview
```

Preview URLs use a dash suffix: `https://{appId}-preview.bkper.app`. For example, an app with `id: my-app` deploys to `https://my-app-preview.bkper.app`.

Preview has independent secrets and KV storage from production.

### Independent handler deployment

Deploy only the events handler:

```bash
bkper app deploy --events
```

Useful when you've only changed the events handler and want a faster deployment. Web is deployed by default.

## Secrets management

Secrets are environment variables stored securely on the platform. Declare them in `bkper.yaml`:

```yaml
deployment:
    secrets:
        - EXTERNAL_SERVICE_TOKEN
```

### Setting secrets

```bash
# Set for production
bkper app secrets put EXTERNAL_SERVICE_TOKEN

# Set for preview
bkper app secrets put EXTERNAL_SERVICE_TOKEN --preview
```

You'll be prompted to enter the value.

### Listing and deleting

```bash
# List all secrets
bkper app secrets list

# Delete a secret
bkper app secrets delete EXTERNAL_SERVICE_TOKEN
```

### Accessing in code

Secrets are available as `c.env.SECRET_NAME` in your Hono handlers:

```ts
app.get('/api/data', async (c) => {
    const token = c.env.EXTERNAL_SERVICE_TOKEN;
    // use token
});
```

During local development, use the `.dev.vars` file instead. See [Development Experience](https://bkper.com/docs/build/apps/development.md#local-secrets).

### KV storage

Declare KV in `bkper.yaml`:

```yaml
deployment:
    services:
        - KV
```

The platform provisions a KV namespace for your app. Access it via `c.env.KV`:

```ts
await c.env.KV.put('key', 'value', { expirationTtl: 3600 });
const value = await c.env.KV.get('key');
```

KV storage is separate between production and preview environments.

## Deployment status

Check the current state of your deployment:

```bash
bkper app status
```

## Installing on books

After deploying, install the app on specific books to activate it:

```bash
# Install on a book
bkper app install <appId> -b <bookId>

# Uninstall from a book
bkper app uninstall <appId> -b <bookId>
```

Once installed, the app's [event handlers](https://bkper.com/docs/build/apps/event-handlers.md) receive events from that book, and the app's [context menu](https://bkper.com/docs/build/apps/context-menu.md) appears in the book's UI.

---
source: /docs/build/apps/development.md

# Development Experience

Local development uses two composable processes — the worker runtime and the client dev server — that run concurrently.

## What runs

```bash
npm run dev
```

The project template runs both processes via `concurrently`:

1. **`vite dev`** — Client dev server with HMR. Changes to Lit components reflect instantly in the browser. Configured in `vite.config.ts`.
2. **`bkper app dev`** — The worker runtime:
   - **Miniflare** — Simulates the Cloudflare Workers runtime locally for the web server and events handler.
   - **Cloudflare tunnel** — Exposes the events handler via a public URL so Bkper can route webhook events to your machine.
   - **File watching** — Server and shared package changes trigger automatic rebuilds via esbuild.

You can also run them independently: `npm run dev:client` for just the UI, or `npm run dev:server` / `npm run dev:events` for specific workers.

## URLs

| Handler | URL |
| --- | --- |
| Client (Vite dev server) | `http://localhost:5173` |
| Web server (Miniflare) | `http://localhost:8787` |
| Events (via tunnel) | `https://<random>.trycloudflare.com/events` |

The Vite dev server proxies `/api` requests to `http://localhost:8787` (configured in `vite.config.ts`). The tunnel URL is automatically registered as the `webhookUrlDev` in Bkper, so events from books where you're the developer are routed to your local machine.

## Configuration flags

You can run specific handlers independently:

```bash
# Start only the web worker
bkper app dev --web

# Start only the events worker
bkper app dev --events

# Override default ports
bkper app dev --sp 8787 --ep 8791
```

## Client configuration

The client dev server is configured in `vite.config.ts` at the project root. This is a standard Vite config — add plugins, adjust settings, or customize the dev server as needed.

### Local development authentication

During local development, the Vite dev server runs a Bkper auth middleware plugin (`createBkperAuthMiddleware()` from `bkper/dev`). This plugin:

1. Uses your CLI credentials (from `bkper auth login`) to obtain and refresh OAuth tokens
2. Injects the token into your client code automatically
3. Proxies `/api` requests to the Miniflare worker

Before starting development, run:

```bash
bkper auth login   # one-time setup
```

Then `npm run dev` handles authentication automatically. The client calls `auth.getAccessToken()` and the middleware ensures the token is valid.

When your client calls an app server route under `/api/*`, include that token as `Authorization: Bearer <token>` to match production dispatch behavior. Local outbound still uses your CLI credentials when the app server calls Bkper.

If you see authentication errors in the browser, verify you're logged in:

```bash
bkper auth token   # should print a token
```

This is the canonical pattern for local development. Do not manually pass tokens or implement custom auth flows.

## Local secrets

Environment variables for local development live in a `.dev.vars` file at the project root:

```bash
# .dev.vars (gitignored)
EXTERNAL_SERVICE_TOKEN=your-token-here
```

Copy from the provided template:

```bash
cp .dev.vars.example .dev.vars
```

These variables are available as `c.env.SECRET_NAME` in your Hono handlers during development.

## KV storage

KV data persists locally in the `.mf/kv/` directory during development. This means your data survives restarts — useful for testing caching and state patterns.

```ts
// Read
const value = await c.env.KV.get('my-key');

// Write with TTL
await c.env.KV.put('my-key', 'value', { expirationTtl: 3600 });
```

See the [Cloudflare KV documentation](https://developers.cloudflare.com/kv/) for more usage patterns.

## Type generation

The `env.d.ts` file provides TypeScript types for the Worker environment — KV bindings, secrets, and other platform services. It's auto-generated based on your `bkper.yaml` configuration and checked into version control.

Rebuild it after changing services or secrets in `bkper.yaml`:

```bash
bkper app build
```

## The development loop

1. Run `npm run dev`
2. Edit client code — see changes instantly via Vite HMR
3. Edit server code — auto-rebuilds and reloads via esbuild watch
4. Trigger events in Bkper — your local handler receives them via the tunnel
5. Check the activity stream in Bkper to see handler responses
6. Iterate

## Debugging

- **Server errors** — Check the terminal output from `bkper app dev`. Worker runtime errors appear here.
- **Event handler errors** — Check the Bkper activity stream. Click on an event handler response to see the result or error, and replay failed events.
- **Client errors** — Use browser DevTools. The Vite dev server provides source maps.

---
source: /docs/build/apps/event-handlers.md

# Event Handlers

Event handlers are the code that reacts to events in your Bkper Books. When a transaction is checked, an account is created, or any other event occurs, your handler receives it and can take action — calculate taxes, sync data between books, post to external services, and more.

![Bkper Event Handler](https://bkper.com/images/bots/bkper-tax-bot/bkper-tax-bot.gif)

## How it works

1. You declare which events your app handles in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md)
2. Bkper sends an HTTP POST to your webhook URL when those events fire
3. Your handler processes the event and returns a response

On the [Bkper Platform](https://bkper.com/docs/build/apps/overview.md), events are routed to your `events` package automatically — including local development via tunnels. Platform event routing uses `/events` and `/events/*` paths only. For [self-hosted](https://bkper.com/docs/build/apps/self-hosted.md) setups, you configure the webhook URL directly.

## Agent identity

Event handlers **run on behalf of the user who installed the app**. Their transactions and activities are identified in the UI by the app's logo and name:

![Event handler agents identified in the activity stream](https://bkper.com/docs/_astro/bkper-bot-agents.CtsWIZEd.png)

## Responses

Handler responses are recorded in the activity that triggered the event. You can view and replay them by clicking the response at the bottom of the activity:

![Event handler responses in the activity stream](https://bkper.com/docs/_astro/bkper-bot-responses.UQXhqdai.png)

### Response format

Your handler must return a response in this format:

```ts
{ result?: string | string[] | boolean; error?: string; warning?: string }
```

- The `result` is recorded as the handler response in the book activity
- If you return `{ result: false }`, the response is suppressed and not recorded
- Errors like `{ error: "This is an error" }` show up as error responses

To show the full error stack trace for debugging:

```ts
try {
    // handler logic
} catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
}
```

### HTML in responses

If you return an **HTML snippet** (e.g., a link) in the result, it will be rendered in the response popup.

## Development mode

Event handlers run in _Development Mode_ when executed by the **developer or owner** of the App.

In development mode, both successful results and errors are shown as responses:

![Event handler error in development mode](https://bkper.com/docs/_astro/bkper-bot-error.4eq2AKEM.png)

You can click a response to **replay** failed executions — useful for debugging without recreating the triggering event.

To find transactions with bot errors in a book, run the query:

```
error:true
```

## Preventing loops

When your event handler creates or modifies transactions, those changes fire new events. To prevent infinite loops, check the `event.agent.id` field:

```ts
function handleEvent(event: bkper.Event) {
    // Skip events triggered by this app
    if (event.agent?.id === 'your-app-id') {
        return { result: false };
    }

    // Process the event
    // ...
}
```

This pattern is essential for any handler that writes back to the same book.

## Authentication

When Bkper calls your event handler's webhook URL, it sends two headers on every request:

- `bkper-oauth-token` — The OAuth access token of the user who installed the app. Use this to call the API back on behalf of the user.
- `bkper-agent-id` — Your app's agent identifier.

Pass these directly to `bkper-js`:

```ts
const bkper = new Bkper({
    oauthTokenProvider: async () => c.req.header('bkper-oauth-token'),
    agentIdProvider: async () => c.req.header('bkper-agent-id'),
});
const book = new Book(event.book, bkper.getConfig());
```

This is the canonical pattern. Do not implement custom authentication for event handlers.

> **Note**
> Both production (`webhookUrl`) and development (`webhookUrlDev`) endpoints receive OAuth tokens in the `bkper-oauth-token` header. During local development, events are routed through the Cloudflare tunnel started by `bkper app dev`.
For [self-hosted](https://bkper.com/docs/build/apps/self-hosted.md) setups, the same headers are sent to your production `webhookUrl`.

## Event routing pattern

On the Bkper Platform, the `events` package uses [Hono](https://hono.dev) to receive webhook calls. A typical pattern routes events by type:

```ts
import { Bkper, Book } from 'bkper-js';

app.post('/', async c => {
    const event: bkper.Event = await c.req.json();

    if (!event.book) {
        return c.json({ error: 'Missing book in event payload' }, 400);
    }

    const bkper = new Bkper({
        oauthTokenProvider: async () => c.req.header('bkper-oauth-token'),
        agentIdProvider: async () => c.req.header('bkper-agent-id'),
    });
    const book = new Book(event.book, bkper.getConfig());

    switch (event.type) {
        case 'TRANSACTION_CHECKED':
            return c.json(await handleTransactionChecked(book, event));
        default:
            return c.json({ result: false });
    }
});
```

## The Event object

The event payload has the following structure:

```ts
{
    /** The id of the Book associated to the Event */
    bookId?: string;

    /** The Book object associated with the Event */
    book?: {
        agentId?: string;
        collection?: Collection;
        createdAt?: string;
        datePattern?: string;
        decimalSeparator?: "DOT" | "COMMA";
        fractionDigits?: number;
        id?: string;
        lastUpdateMs?: string;
        lockDate?: string;
        name?: string;
        ownerName?: string;
        pageSize?: number;
        period?: "MONTH" | "QUARTER" | "YEAR";
        periodStartMonth?: "JANUARY" | "FEBRUARY" | "MARCH" | "APRIL"
            | "MAY" | "JUNE" | "JULY" | "AUGUST" | "SEPTEMBER"
            | "OCTOBER" | "NOVEMBER" | "DECEMBER";
        permission?: "OWNER" | "EDITOR" | "POSTER" | "RECORDER"
            | "VIEWER" | "NONE";
        properties?: { [name: string]: string };
        timeZone?: string;
        timeZoneOffset?: number;
    };

    /** The user in charge of the Event */
    user?: {
        avatarUrl?: string;
        name?: string;
        username?: string;
    };

    /** The Event agent, such as the App, Bot or Bank institution */
    agent?: {
        id?: string;
        logo?: string;
        name?: string;
    };

    /** The creation timestamp, in milliseconds */
    createdAt?: string;

    /** The event data */
    data?: {
        /** The object payload. Depends on the event type. */
        object?: any;
        /** The object previous attributes when updated */
        previousAttributes?: { [name: string]: string };
    };

    /** The unique id that identifies the Event */
    id?: string;

    /** The resource associated to the Event */
    resource?: string;

    /** The type of the Event */
    type?: EventType;
}
```

The event payload is the same structure exposed by the [REST API](https://bkper.com/docs/build/scripts/rest-api.md). If you use TypeScript, add the [`@bkper/bkper-api-types`](https://www.npmjs.com/package/@bkper/bkper-api-types) package to your project for full type definitions.

For update events, `data.previousAttributes` contains the fields that changed and their previous values — useful for computing diffs or reacting only to specific field changes.

## Event types

Declare which events your app handles in `bkper.yaml`:

```yaml
events:
    - TRANSACTION_CHECKED
    - TRANSACTION_POSTED
    - ACCOUNT_CREATED
```

The complete current set of event types:

| Event | Description |
| --- | --- |
| `FILE_CREATED` | A file was attached to the book. |
| `FILE_UPDATED` | An attached file was updated. |
| `TRANSACTION_CREATED` | A draft transaction was created. |
| `TRANSACTION_UPDATED` | A transaction was updated. |
| `TRANSACTION_DELETED` | A transaction was deleted. |
| `TRANSACTION_POSTED` | A draft transaction was posted and now affects balances. |
| `TRANSACTION_CHECKED` | A posted transaction was checked (reviewed and locked). |
| `TRANSACTION_UNCHECKED` | A checked transaction was unchecked and becomes editable again. |
| `TRANSACTION_RESTORED` | A deleted transaction was restored. |
| `ACCOUNT_CREATED` | An account was created. |
| `ACCOUNT_UPDATED` | An account was updated. |
| `ACCOUNT_DELETED` | An account was deleted. |
| `QUERY_CREATED` | A saved query was created. |
| `QUERY_UPDATED` | A saved query was updated. |
| `QUERY_DELETED` | A saved query was deleted. |
| `GROUP_CREATED` | A group was created. |
| `GROUP_UPDATED` | A group was updated. |
| `GROUP_DELETED` | A group was deleted. |
| `COMMENT_CREATED` | A comment was added. |
| `COMMENT_DELETED` | A comment was deleted. |
| `COLLABORATOR_ADDED` | A collaborator was added to the book. |
| `COLLABORATOR_UPDATED` | A collaborator's permissions were updated. |
| `COLLABORATOR_REMOVED` | A collaborator was removed from the book. |
| `INTEGRATION_CREATED` | An integration was created in the book. |
| `INTEGRATION_UPDATED` | An integration was updated. |
| `INTEGRATION_DELETED` | An integration was deleted. |
| `BOOK_CREATED` | A book was created. |
| `BOOK_AUDITED` | A balances audit completed for the book. |
| `BOOK_UPDATED` | Book settings were updated. |
| `BOOK_DELETED` | The book was deleted. |

---
source: /docs/build/apps/first-app.md

# Your First App

This tutorial walks you through building and deploying a Bkper app from scratch. For the deep reference on any topic — architecture, configuration, development, events, or deployment — follow the links in each step.

## Prerequisites

[Development Setup](https://bkper.com/docs/build/getting-started/setup.md) — the CLI installed and authenticated.

## Walkthrough

1. **Scaffold from the template**

    ```bash
    bkper app init my-app
    cd my-app
    ```

    The CLI sets your app ID, package name, URLs, and event-handler loop guards automatically. See [App Configuration](https://bkper.com/docs/build/apps/configuration.md) for the full `bkper.yaml` reference.

2. **Start developing**

    ```bash
    npm run dev
    ```

    This runs the Vite client dev server and the local worker runtime with automatic webhook tunneling. See [Development Experience](https://bkper.com/docs/build/apps/development.md) for details.

3. **Open the app**

    Visit [http://localhost:5173](http://localhost:5173). Select a book to see account balances. No OAuth setup required — the platform handles authentication.

4. **Trigger an event**

    Go to any Bkper book and check (reconcile) a transaction. Your local event handler receives the webhook via the tunnel and creates a 20% draft transaction. See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for the full event model.

5. **Make a change**

    Edit the handler in `packages/events/src/handlers/transaction-checked.ts` and save. The worker reloads automatically. Check another transaction to see your change.

6. **Customize your listing**

    Update `bkper.yaml` with your app's description, owner details, and repository URL. Replace the placeholder logos in `packages/web/client/public/images/`. See [App Listing](https://bkper.com/docs/build/apps/app-listing.md) for publishing details.

7. **Update the README**

    Edit `README.md` for end users — what the app does and how to use it. Keep developer docs in `AGENTS.md`.

8. **Deploy**

    ```bash
    npm run build
    bkper app sync
    bkper app deploy
    ```

    Your app is live at `https://my-app.bkper.app`. See [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) for preview environments, secrets, and KV.

## What you built

| You wrote | Platform handled |
| --- | --- |
| ~30 lines of UI | OAuth, consent screen, token refresh |
| ~40 lines of event logic | Hosting, SSL, edge routing |
| `bkper.yaml` | Webhook tunnels, KV, type generation |

## Next steps

- [App Architecture](https://bkper.com/docs/build/apps/architecture.md) — Understand the three-package pattern
- [App Configuration](https://bkper.com/docs/build/apps/configuration.md) — Full `bkper.yaml` reference
- [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) — All event types and patterns
- [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) — Preview environments and secrets

---
source: /docs/build/apps/overview.md

# The Bkper Platform

The Bkper Platform is a complete managed environment for building, deploying, and hosting apps on Bkper. It removes infrastructure complexity so you can focus on business logic.

### Hosting

Apps are deployed to `{appId}.bkper.app` on a global edge network powered by [Cloudflare Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/). Your app runs close to your users, with zero infrastructure to manage.

Preview environments are built in — deploy to a preview URL to test before going to production.

### Authentication

OAuth is pre-configured. No client IDs, no redirect URIs, no consent screens to build.

- **Web client** — Use `@bkper/web-auth`: `auth.getAccessToken()`. See [App Architecture → Web client authentication](https://bkper.com/docs/build/apps/architecture.md#web-client-authentication).
- **Server API routes** — Send `Authorization: Bearer <token>` to `/api/*`; dispatch validates it and platform outbound injects auth for server-side Bkper API calls. See [App Architecture → Server API authentication](https://bkper.com/docs/build/apps/architecture.md#server-api-authentication).
- **Event handlers** — The user's OAuth token arrives in the `bkper-oauth-token` header. See [Event Handlers → Authentication](https://bkper.com/docs/build/apps/event-handlers.md#authentication).
- **Local development** — The Vite auth middleware uses your CLI credentials. See [Development Experience → Local development authentication](https://bkper.com/docs/build/apps/development.md#local-development-authentication).

### Services

Declare the services you need in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md) and the platform provisions them:

- **KV storage** — Key-value storage for caching and state. Access via `c.env.KV` in your handlers.
- **Secrets** — Securely stored environment variables. Set via `bkper app secrets put`, access via `c.env.SECRET_NAME`.

### Developer experience

The project template composes the full development environment:

```bash
npm run dev
```

This runs two processes concurrently: `vite dev` for the client UI (HMR), and `bkper app dev` for the worker runtime (Miniflare for your server and event handlers, plus a Cloudflare tunnel so Bkper can route webhook events to your laptop). Your entire development environment, running locally.

### Deployment

Build and deploy your app:

```bash
npm run build && bkper app sync && bkper app deploy
```

Your app is live at `{appId}.bkper.app`. The platform handles routing, SSL, and edge distribution.

## What you'd build yourself without it

Without the platform, creating a Bkper app with a UI, event handling, and authentication requires:

| Concern | Without the platform | With the platform |
| --- | --- | --- |
| **Hosting** | Provision servers, configure domains, SSL, CDN | `bkper app deploy` |
| **Authentication** | Register OAuth client, build consent screen, handle token refresh, manage redirect URIs | `auth.getAccessToken()` |
| **Event webhooks** | Set up a public endpoint, configure DNS, handle JWT verification | Declare in `bkper.yaml`, platform routes events |
| **Local dev webhooks** | Install ngrok or similar, manually configure tunnel URL | `bkper app dev` starts tunnel automatically |
| **Secrets** | Set up a secrets manager, configure access | `bkper app secrets put` |
| **KV storage** | Deploy Redis/Memcached, manage connections | Declare `KV` in `bkper.yaml` |
| **Preview environments** | Build a staging pipeline | `bkper app deploy --preview` |
| **Type safety** | Manually create type definitions | `env.d.ts` auto-generated |

The platform eliminates all of this. You write business logic, the platform handles infrastructure.

## Getting started

```bash
# Create a new app from the template
bkper app init my-app

# Start developing
npm run dev
```

This gives you a working app with a client UI, server API, and event handler — all running locally with full HMR and webhook tunneling.

See [Your First App](https://bkper.com/docs/build/apps/first-app.md) for a complete walkthrough, or continue to [App Architecture](https://bkper.com/docs/build/apps/architecture.md) to understand how platform apps are structured.

---
source: /docs/build/apps/self-hosted.md

# Self-Hosted Alternative

The [Bkper Platform](https://bkper.com/docs/build/apps/overview.md) handles hosting, authentication, and deployment for you. However, you can host event handlers on your own infrastructure if you have specific requirements — existing cloud setup, compliance constraints, or legacy apps.

> **Tip**
> Use the Bkper Platform unless you have a specific reason to self-host. It eliminates the need to manage authentication, secrets, hosting, and deployment yourself.
## Cloud Functions

A Bkper event handler running on [Google Cloud Functions](https://cloud.google.com/functions/) receives authenticated calls from the `bkper-hrd@appspot.gserviceaccount.com` service account. You need to grant this service account the [Cloud Functions Invoker IAM role](https://cloud.google.com/functions/docs/securing/managing-access-iam) (`roles/cloudfunctions.invoker`).

Set the production endpoint in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md):

```yaml
webhookUrl: https://us-central1-my-project.cloudfunctions.net/events
```

### Authentication

An OAuth Access Token **of the user who installed the app** is sent to the production `webhookUrl` endpoint in the `bkper-oauth-token` HTTP header, along with the agent identifier in `bkper-agent-id`, on each event. Your handler uses this token to call the API back on behalf of the user.

Both production (`webhookUrl`) and development (`webhookUrlDev`) endpoints receive OAuth tokens in the `bkper-oauth-token` header.

### Throughput and scaling

Event throughput can be high, especially when processing large batches. Set the [max instance limit](https://cloud.google.com/functions/docs/max-instances#setting_max_instances_limits) — usually **1-2 is enough**. When the function returns `429 Too Many Requests`, the event is automatically retried with incremental backoff until it receives an HTTP `200`.

### Response format

The function response must follow the standard format:

```ts
{ result?: any, error?: any }
```

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md#response-format) for details on response handling.

### Considerations

- Execution environment is subject to [Cloud Function Quotas](https://cloud.google.com/functions/quotas) — quota counts against the developer account, not the end user
- Recommended for scenarios where event throughput exceeds **1 event/second/user** and processing can be handled asynchronously
- Can be combined with context menus built with [Apps Script HTML Service](https://developers.google.com/apps-script/guides/html) or any other UI infrastructure

---

## Generic Webhooks

You can host event handlers on any infrastructure — other cloud providers, containers, on-premise servers.

Configure the same `webhookUrl` property in [`bkper.yaml`](https://bkper.com/docs/build/apps/configuration.md):

```yaml
webhookUrl: https://my-server.example.com/bkper/events
```

### Authentication

Calls to the production webhook URL are signed with a JWT token using the [Service to Function](https://cloud.google.com/functions/docs/securing/authenticating#service-to-function) method. You can verify this token to assert the identity of the Bkper service.

> **Note**
> Cloud Functions handles JWT verification automatically. For other infrastructure, you need to implement verification yourself. We strongly recommend Cloud Functions for this reason.
### Retry behavior

If your infrastructure returns an HTTP `429` status, the event is automatically retried with incremental backoff until it receives an HTTP `200`. Use this to handle temporary overload gracefully.
