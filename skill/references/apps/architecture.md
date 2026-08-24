# App Architecture

Bkper platform apps use one Worker bundle per app and environment. The same Worker serves the browser client, app-defined `/api/*` routes, and Bkper event ingress at `/events`.

Treat `/api/*` as the reusable surface for app behavior. The bundled web client is one consumer; scripts, external clients, and agents can call the same routes with bearer authentication.

## Structure

```txt
my-app/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/
│       ├── auth/
│       ├── components/
│       └── services/
├── server/
│   ├── package.json
│   └── src/
│       ├── api/
│       ├── events/
│       ├── services/
│       └── index.ts
├── scripts/
├── bkper.yaml
├── env.d.ts
├── package.json
├── package-lock.json
└── tsconfig.json
```

The root npm workspace orchestrates development, tests, builds, and deployment. The template keeps browser dependencies in `client/` and Worker dependencies in `server/`. Add a shared package only when both sides actually need one.

## Client

The client uses:

- [Lit](https://lit.dev/) for components and rendering.
- [Web Awesome](https://webawesome.com/) for UI components.
- [`@bkper/web-design`](https://www.npmjs.com/package/@bkper/web-design) for Bkper design tokens.
- [Vite](https://vitejs.dev/) for development and production builds, configured in `client/vite.config.ts`.

Client code has two data paths. Choose based on who owns the behavior:

- **Direct Bkper calls** use `bkper-js` for generic Bkper data needed only by the browser UI.
- **App API calls** use the generated typed client in `client/src/api/` with `auth.authenticatedFetch()` for app-owned behavior, especially when it needs server-only capabilities or more than one caller.

Keep app-owned behavior in one place. Do not implement the same behavior separately in the UI and the app API.

For stateful feature components, co-locate view, controller, and CSS files in one folder under `components/`. Simple presentational components can remain in one file.

### Client authentication

The client authenticates users with [`@bkper/web-auth`](https://www.npmjs.com/package/@bkper/web-auth). OAuth is preconfigured on the platform, so there are no client IDs, redirect URIs, or consent screens to configure.

```ts
import { Bkper } from 'bkper-js';
import { BkperAuth } from '@bkper/web-auth';

const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
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

`@bkper/web-auth` handles login, redirects, and token refresh. The template keeps this behavior behind `client/src/auth/auth-session.ts`.

See the [@bkper/web-auth API Reference](https://bkper.com/docs/api/bkper-web-auth.md) for the full SDK documentation.

## Server Worker

The server runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) and uses [Hono](https://hono.dev/) with typed OpenAPI routes. It handles:

- app API routes under `/api/*`;
- Bkper event ingress under `/events`;
- platform services such as KV and secrets through `c.env`;
- static client assets through the `ASSETS` binding.

The Worker entry point composes those concerns while routes delegate business behavior to services:

```ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerApiRoutes } from './api/routes.js';
import { registerEventRoutes } from './events/routes.js';
import { appContextMiddleware, type AppEnv } from './app-context.js';

const app = new OpenAPIHono();

app.use('/api/*', appContextMiddleware());
app.use('/events', appContextMiddleware());
registerApiRoutes(app);
registerEventRoutes(app);

app.get('*', c => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

## App API contract

The default template publishes versioned routes under `/api/v1/*` and exposes their OpenAPI contract at `/openapi.json`.

| Concern                      | Location                              |
| ---------------------------- | ------------------------------------- |
| OpenAPI metadata             | `server/src/api/openapi.ts`           |
| Request and response schemas | `server/src/api/schemas.ts`           |
| Thin route handlers          | `server/src/api/routes.ts`            |
| Business behavior            | `server/src/services/`                |
| Generated client types       | `client/src/api/generated/types.d.ts` |
| Typed client wrapper         | `client/src/api/app-api.ts`           |
| Contract snapshot            | `server/test/api/openapi.snapshot.json` |

When changing the API:

1. Update schemas, services, routes, and focused unit tests.
2. Run `npm run api` to regenerate client types.
3. Review the OpenAPI snapshot when the public contract changes.
4. Run `npm run check` before release.

Keep existing `/api/v1/*` contracts backward compatible. Additive fields and routes can remain in `v1`; breaking changes belong in a new namespace such as `/api/v2/*`.

### Reuse Bkper API types

When an app API returns payloads from the Bkper REST API, reference the canonical types from `@bkper/bkper-api-types` instead of recreating their fields in the app. The template's balances endpoint demonstrates this with `bkper.Book`:

```ts
export const BookSchema = z
    .custom<bkper.Book>(value => value !== undefined)
    .openapi('Book', {
        type: 'object',
        additionalProperties: true,
        'x-typescript-type': 'bkper.Book',
    });
```

The template's API generator recognizes `x-typescript-type`, imports `@bkper/bkper-api-types`, and emits the canonical reference in `client/src/api/generated/types.d.ts`:

```ts
Book: bkper.Book;
```

Both the server and client packages include `@bkper/bkper-api-types` for local typechecking. Run `npm run api` after adding or changing these schemas.

This bridge provides compile-time types but does not validate payload fields at runtime. Use it directly for trusted Bkper-owned responses. Request bodies, especially those used to create or modify Book resources, still require concrete Zod validation.

### URLs

```txt
Production API: https://{appId}.bkper.app/api/*
Preview API:    https://{appId}-preview.bkper.app/api/*
Local API:      http://localhost:8787/api/*

Production spec: https://{appId}.bkper.app/openapi.json
Preview spec:    https://{appId}-preview.bkper.app/openapi.json
Local spec:      http://localhost:8787/openapi.json
```

Example script call:

```bash
TOKEN="$(bkper auth token)"

curl \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://my-app.bkper.app/api/v1/ping"
```

Replace `my-app` with the app id from `bkper.yaml`.

### Server API authentication

Deployed `/api/*` routes require a Bkper OAuth bearer token. The template client uses `authenticatedFetch()` so token attachment and refresh stay inside `@bkper/web-auth`:

```ts
const response = await auth.authenticatedFetch('/api/v1/ping');
```

Dispatch validates the incoming bearer token and strips the `Authorization` header before the Worker runs. Server code should not read or forward the token.

When a route calls Bkper, create the SDK without a token provider:

```ts
import { Bkper } from 'bkper-js';

const bkper = new Bkper();
const books = await bkper.getBooks();
```

Platform outbound authentication injects the validated user's OAuth token on Bkper API requests.

### Authorize app operations

Platform authentication identifies the Bkper user and provides outbound authentication for server-side Bkper requests. Your app must still decide which authenticated users may perform each operation. Protect sensitive data and actions in the server API; client-side checks may improve the UI, but they are not an authorization boundary.

#### Restrict an internal app by user domain

For an app intended only for people in one organization, authorize the authenticated user's hosted domain:

```ts
const ALLOWED_DOMAIN = 'example.com';

const user = await context.bkper.getUser();
const domain = user.getHostedDomain()?.toLowerCase();

if (domain !== ALLOWED_DOMAIN) {
    return c.json(buildApiError('FORBIDDEN', 'This app is restricted to your organization'), 403);
}
```

#### Authorize a Book-backed operation

When an operation acts on a Book, use an explicit permission allowlist appropriate to that operation. For an operation that requires edit access:

```ts
import { Permission } from 'bkper-js';

const EDIT_PERMISSIONS: readonly Permission[] = [Permission.EDITOR, Permission.OWNER];

const book = await context.bkper.getBook(bookId);

if (!EDIT_PERMISSIONS.includes(book.getPermission())) {
    return c.json(
        buildApiError('FORBIDDEN', 'Editor or owner permission required for this operation'),
        403
    );
}
```

Read, posting, and other operations may require different policies. Choose the minimum authorization appropriate to the behavior instead of treating every authenticated user as authorized.

#### Require app installation

Having permission to access a Book does not mean the app is installed in that Book. If an app is only supposed to be used with Books where it is installed, verify installation:

```ts
const APP_ID = 'my-app';

const book = await context.bkper.getBook(bookId);
const installedApps = await book.getApps();
const isInstalled = installedApps.some(app => app.getId() === APP_ID);

if (!isInstalled) {
    return c.json(buildApiError('FORBIDDEN', 'This app is not installed in this Book'), 403);
}
```

## Event handlers

Platform event deliveries reach `/events` on the same Worker. Event adapters live in `server/src/events/`, while reusable business behavior belongs in `server/src/services/`.

Event code uses server-side `new Bkper()` and must not read `bkper-oauth-token`, `bkper-agent-id`, or `Authorization` headers. Dispatch and platform outbound authentication handle the event token and app agent identity.

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for routing, responses, loop prevention, and event types. Self-hosted handlers process event authentication directly because the platform outbound layer is not involved.

## App shapes

The platform supports different shapes:

- **Full app** — Client UI, `/api/*` backend behavior, and `/events` automation in one Worker. This is the default template.
- **Event-only app** — Keep `server/` and omit `deployment.client`.
- **UI-only app** — Keep a minimal Worker for static assets when behavior is truly browser-only. Add `/api/*` when scripts, integrations, or agents should reuse that behavior.
