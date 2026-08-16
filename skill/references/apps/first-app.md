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

    `bkper app init my-app` creates `./my-app` and uses `my-app` as the app id. The CLI sets your package name, URLs, and event-handler loop guards automatically. See [App Configuration](https://bkper.com/docs/build/apps/configuration.md) for the full `bkper.yaml` reference.

2. **Install and start developing**

    ```bash
    npm install
    npm run dev
    ```

    This runs the Vite client dev server and the local Worker runtime with automatic event tunneling. See [Development Experience](https://bkper.com/docs/build/apps/development.md) for details.

3. **Open the app**

    Visit [http://localhost:5173](http://localhost:5173). Select a book to see account balances. No OAuth setup required — the platform handles authentication.

4. **Trigger an event**

    Go to any Bkper book and check a transaction. The event handler creates a 20% draft using the original from and to Accounts. It does not affect balances unless posted. See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for the full event model.

5. **Make a change**

    Edit `server/src/events/handlers/transaction-checked.ts` and save. The Worker reloads automatically. Check another transaction to see your change.

6. **Customize your listing**

    Update `bkper.yaml` with your app's description and owner details. Replace the placeholder logos in `client/public/images/`. See [App Listing](https://bkper.com/docs/build/apps/app-listing.md) for publishing details.

7. **Update the README**

    Edit `README.md` for end users — what the app does and how to use it. If your app exposes `/api/*` routes for users or integrators, include the app API base URL, `/openapi.json` URL, and one minimal authenticated example. Keep deeper developer docs in `AGENTS.md`.

8. **Establish shared source**

    Review the app, create its first commit, and sync it:

    ```bash
    git add .
    git commit -m "Initial app"
    bkper app sync
    ```

    For an eligible standalone app without an external remote, sync creates private Bkper-managed source and configures it as `origin`. Authorized teammates and coding agents can then clone the same codebase with `bkper app clone my-app`. See [Shared App Source](https://bkper.com/docs/build/apps/shared-app-source.md) for access rules and other source workflows.

9. **Check and deploy**

    ```bash
    npm run check
    npm run deploy
    ```

    Deployment is explicit: syncing or pushing source does not deploy the app. Your app is live at `https://my-app.bkper.app`. See [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) for preview environments, secrets, and KV.

## Next steps

- [Shared App Source](https://bkper.com/docs/build/apps/shared-app-source.md) — Clone and improve one private app codebase together
- [App Architecture](https://bkper.com/docs/build/apps/architecture.md) — Understand the single Worker client/server structure
- [App Configuration](https://bkper.com/docs/build/apps/configuration.md) — Full `bkper.yaml` reference
- [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) — All event types and patterns
- [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) — Preview environments and secrets
