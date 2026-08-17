# The Bkper Platform

The Bkper Platform is a complete managed environment for building, deploying, and hosting apps on Bkper. It removes infrastructure complexity so you can focus on business logic.

### Hosting

Apps are deployed to `{appId}.bkper.app` on a global edge network powered by [Cloudflare Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/). Your app runs close to your users, with zero infrastructure to manage.

Preview environments are built in — deploy to a preview URL to test before going to production.

### App APIs

The same Worker can expose app-defined `/api/*` routes. Treat those routes as the reusable contract for your app behavior:

- The bundled web client can call them.
- Scripts, external clients, and agents can call them too.
- The default template documents them with an app OpenAPI spec at `/openapi.json`.

### AI inference

When an app needs model inference, use Bkper AI by default. An authenticated app API route or event establishes the user and app identity, then platform outbound supplies authorization and usage attribution for the Worker's Bkper AI requests. The app does not need provider credentials.

See [Add Bkper AI to an App](https://bkper.com/docs/build/apps/ai.md) for live model discovery, strict structured output, validation, and the client-to-Worker authentication flow.

### Authentication

OAuth is pre-configured. No client IDs, no redirect URIs, no consent screens to build.

- **Web client** — Use `@bkper/web-auth`: `auth.getAccessToken()`. See [App Architecture → Client authentication](https://bkper.com/docs/build/apps/architecture.md#client-authentication).
- **Server API routes** — Send `Authorization: Bearer <token>` to `/api/*`; dispatch validates it and platform outbound injects auth for server-side Bkper API calls. See [App Architecture → Server API authentication](https://bkper.com/docs/build/apps/architecture.md#server-api-authentication).
- **Event handlers** — Handle `/events` in the same Worker and call Bkper with server-side `new Bkper()`; dispatch/outbound handle auth and agent identity. See [Event Handlers → Authentication](https://bkper.com/docs/build/apps/event-handlers.md#authentication).
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

This runs two processes concurrently: `vite dev` for the client UI (HMR), and `bkper app dev` for the Worker runtime (Miniflare for `/api/*` and `/events`, plus a Cloudflare tunnel so Bkper can route webhook events to your laptop). Your entire development environment, running locally.

### Shared app source

Bkper can host one private codebase for your app. Authorized teammates and coding agents can clone it, improve it locally, and continue building from the same shared history.

Source synchronization remains separate from deployment. A Git push stores source but never builds or deploys the app.

See [Shared App Source](https://bkper.com/docs/build/apps/shared-app-source.md) for the collaboration workflow, access rules, and external Git options.

### Deployment

Check and deploy the app template:

```bash
npm run check
npm run deploy
```

Your app is live at `{appId}.bkper.app`. The platform handles routing, SSL, and edge distribution.

## What you'd build yourself without it

Without the platform, creating a Bkper app with a UI, event handling, and authentication requires:

| Concern                  | Without the platform                                                                    | With the platform                               |
| ------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Hosting**              | Provision servers, configure domains, SSL, CDN                                          | `bkper app deploy`                              |
| **Authentication**       | Register OAuth client, build consent screen, handle token refresh, manage redirect URIs | `auth.getAccessToken()`                         |
| **Event webhooks**       | Set up a public endpoint, configure DNS, handle JWT verification                        | Declare in `bkper.yaml`, platform routes events |
| **Local dev webhooks**   | Install ngrok or similar, manually configure tunnel URL                                 | `bkper app dev` starts tunnel automatically     |
| **Secrets**              | Set up a secrets manager, configure access                                              | `bkper app secrets put`                         |
| **KV storage**           | Deploy Redis/Memcached, manage connections                                              | Declare `KV` in `bkper.yaml`                    |
| **Preview environments** | Build a staging pipeline                                                                | `bkper app deploy --preview`                    |
| **Shared app source**    | Operate a separate private Git host                                                     | Managed source for app developers and agents    |
| **Type safety**          | Manually create type definitions                                                        | `env.d.ts` auto-generated                       |

The platform eliminates all of this. You write business logic, the platform handles infrastructure.

## Getting started

```bash
# Create a new app from the template
bkper app init my-app
cd my-app

# Install dependencies and start developing
npm install
npm run dev
```

This gives you a working app with a client UI, server API routes, and `/events` handling in one Worker — all running locally with full HMR and webhook tunneling.

## Next steps

- [Your First App](https://bkper.com/docs/build/apps/first-app.md) — Build and deploy a complete platform app
- [Shared App Source](https://bkper.com/docs/build/apps/shared-app-source.md) — Collaborate from one private codebase
- [App Architecture](https://bkper.com/docs/build/apps/architecture.md) — Understand how platform apps are structured
