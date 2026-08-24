# Development Experience

Local development uses two composable processes — the worker runtime and the client dev server — that run concurrently.

## What runs

```bash
npm run dev
```

The project template runs both processes via `concurrently`:

1. **`vite dev`** — Client dev server with HMR. Changes to Lit components reflect instantly in the browser. Configured in `client/vite.config.ts`.
2. **`bkper app dev`** — The worker runtime:
    - **Miniflare** — Simulates the single Cloudflare Worker locally.
    - **Cloudflare tunnel** — Exposes `/events` via a public URL so Bkper can route webhook events to your machine.
    - **File watching** — Server changes trigger automatic rebuilds via esbuild.

You can also run them independently: `npm run dev:client` for just the UI, or `npm run dev:server` for the local Worker.

## URLs

| Endpoint                               | URL                                         |
| -------------------------------------- | ------------------------------------------- |
| Client (Vite dev server)               | `http://localhost:5173`                     |
| Server Worker (Miniflare)              | `http://localhost:8787`                     |
| App API routes                         | `http://localhost:8787/api/*`               |
| App OpenAPI spec                       | `http://localhost:5173/openapi.json`        |
| Events (via tunnel to the same Worker) | `https://<random>.trycloudflare.com/events` |

The Vite dev server proxies `/api` and `/openapi.json` requests to `http://localhost:8787` through `client/vite.config.ts`, so the client and OpenAPI spec share the same local origin just as they do in production. The spec also remains available directly from the Worker at `http://localhost:8787/openapi.json`. The tunnel URL is automatically registered as `webhookUrlDev`, so development-mode events are routed to your local machine.

## Configuration flags

There is one local Worker. Override its port when needed:

```bash
bkper app dev --sp 8787
```

## Client configuration

The client dev server is configured in `client/vite.config.ts`. This standard Vite configuration registers local auth middleware and proxies `/api` and `/openapi.json` requests to the Worker.

### Local development authentication

During local development, the Vite dev server runs `createBkperAuthMiddleware()` from `bkper/dev`. It serves the local `/auth/refresh` endpoint used by `@bkper/web-auth`, obtaining OAuth tokens from your CLI credentials.

The separate Vite proxy configuration forwards `/api` and `/openapi.json` requests to the Miniflare Worker.

Before starting development, run:

```bash
bkper auth login   # one-time setup
```

Then `npm run dev` handles local authentication. Direct `bkper-js` calls use `auth.getAccessToken()`, while the typed app API client uses `auth.authenticatedFetch()` to attach and refresh bearer authentication.

Local outbound uses your CLI credentials when the app server or event handler calls Bkper.

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

1. Run `npm run dev`.
2. Edit client code and use Vite HMR.
3. Edit server code and let the Worker reload.
4. Trigger events in Bkper and inspect handler responses in the activity stream.
5. Run `npm run check` before considering the change complete.

## Debugging

- **Server errors** — Check the terminal output from `bkper app dev`. Worker runtime errors appear here.
- **Event handler errors** — Check the Bkper activity stream. Click on an event handler response to see the result or error, and replay failed events.
- **Client errors** — Use browser DevTools. The Vite dev server provides source maps.
