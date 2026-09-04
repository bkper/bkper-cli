# Building & Deploying

## The deployment workflow

Sync and deployment require an attached, clean, committed Git branch whose current commit is stored remotely. Bkper-managed private Git is recommended. Apps without Git receive actionable initialization and managed-sync instructions from the CLI; external repositories must configure and push the current branch to its intended upstream.

Run the template's deterministic checks before releasing:

```bash
npm run check
```

1. **Build** — Compile your code

    ```bash
    npm run build
    ```

    This runs two build steps:
    - Client (Vite) to static assets in `dist/client/`
    - Server Worker bundle (esbuild) to `dist/server/`

    Build output includes size reporting so you can monitor bundle sizes.

2. **Sync** — Update app metadata and managed source

    ```bash
    bkper app sync
    ```

    Verifies stored source, then syncs your `bkper.yaml` configuration to Bkper — name, description, menu URLs, webhook URLs, access control, and branding. For managed source, it safely pushes the current clean, committed branch. For external source, it fetches the configured upstream and verifies that it contains the current commit. Sync does not build or deploy the app.

3. **Deploy** — Upload the local build to the platform

    ```bash
    bkper app deploy
    ```

    Deploy verifies stored source again. Managed source is pushed and Platform-verified; external source is checked against the configured upstream by the CLI. Deploy then uploads your existing pre-built code from `dist/` to the Bkper Platform. The command does not run a build, and the Platform does not prove that `dist/` was produced from the verified commit. Your app is live at `https://{appId}.bkper.app`.

The app template combines all three after source changes are committed:

```bash
npm run deploy
```

Use `npm run deploy:preview` for the preview environment.

> **Caution: Source is not deployment**
> An ordinary `git push` stores source only and never deploys. `bkper app sync` also does not deploy. Run `bkper app deploy` explicitly when the local build is ready to release.
See [Shared App Source](https://bkper.com/docs/platform/apps/shared-app-source.md) for managed-source setup, cloning, access, and external Git workflows.

### Production

The default deployment target. Your app runs at `https://{appId}.bkper.app`.

```bash
bkper app deploy
```

Production serves:

```txt
Client:       https://{appId}.bkper.app
API routes:   https://{appId}.bkper.app/api/*
OpenAPI spec: https://{appId}.bkper.app/openapi.json
Events:       https://{appId}.bkper.app/events
```

### Preview

Deploy to a separate preview environment for testing before production:

```bash
bkper app deploy --preview
```

Preview URLs use a dash suffix: `https://{appId}-preview.bkper.app`. For example, an app with `id: my-app` deploys to `https://my-app-preview.bkper.app`.

Preview serves:

```txt
Client:       https://{appId}-preview.bkper.app
API routes:   https://{appId}-preview.bkper.app/api/*
OpenAPI spec: https://{appId}-preview.bkper.app/openapi.json
Events:       https://{appId}-preview.bkper.app/events
```

Preview has independent secrets and KV storage from production.

There is one app deployment per environment. `/events` is handled by the same Worker as the client assets and `/api/*` routes.

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
app.get('/api/data', async c => {
    const token = c.env.EXTERNAL_SERVICE_TOKEN;
    // use token
});
```

During local development, use the `.dev.vars` file instead. See [Development Experience](https://bkper.com/docs/platform/apps/development.md#local-secrets).

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

Once installed, the app's [event handlers](https://bkper.com/docs/platform/apps/event-handlers.md) receive events from that book at `/events`, and the app's [context menu](https://bkper.com/docs/platform/apps/context-menu.md) appears in the book's UI.

## Next steps

- [Shared App Source](https://bkper.com/docs/platform/apps/shared-app-source.md) — Share private source without coupling Git pushes to deployment
- [Development Experience](https://bkper.com/docs/platform/apps/development.md) — Run the app and event delivery locally
- [App Listing](https://bkper.com/docs/platform/apps/app-listing.md) — Prepare the app for installation
