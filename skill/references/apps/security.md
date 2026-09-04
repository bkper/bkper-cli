# App Security

Bkper and each platform app have separate security responsibilities. This guide explains the platform authentication boundary and common authorization checks an app must enforce.

## Authentication and authorization

Authentication identifies the Bkper user making a request. The platform handles this flow for deployed apps.

Authorization determines whether that user may perform a specific operation.

See [App Architecture](https://bkper.com/docs/platform/apps/architecture.md) for the client and server authentication flow.

## Authorize app operations

Platform authentication identifies the Bkper user and provides outbound authentication for server-side Bkper requests. Your app must still decide which authenticated users may perform each operation. Protect sensitive data and actions in the server API; client-side checks may improve the UI, but they are not an authorization boundary.

### Restrict an internal app by user domain

For an app intended only for people in one organization, authorize the authenticated user's hosted domain:

```ts
const ALLOWED_DOMAIN = 'example.com';

const user = await context.bkper.getUser();
const domain = user.getHostedDomain()?.toLowerCase();

if (domain !== ALLOWED_DOMAIN) {
    return c.json(buildApiError('FORBIDDEN', 'This app is restricted to your organization'), 403);
}
```

### Authorize a Book-backed operation

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

### Require app installation

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

## Next Steps

- [App Quality Guidelines](https://bkper.com/docs/platform/apps/quality.md) — Review cross-cutting app quality and security expectations.
- [App Architecture](https://bkper.com/docs/platform/apps/architecture.md) — Understand client and server authentication flows.
- [Building & Deploying](https://bkper.com/docs/platform/apps/deploying.md#setting-secrets) — Store production and preview secrets.
- [Event Handlers](https://bkper.com/docs/platform/apps/event-handlers.md#authentication) — Understand authentication for platform and self-hosted events.
