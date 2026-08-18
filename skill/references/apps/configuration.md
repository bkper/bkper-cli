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

## Starter example

From the [app template](https://github.com/bkper/bkper-app-template):

```yaml
id: my-app
name: My App
description: A Bkper app that does something useful

logoUrl: https://my-app.bkper.app/images/logo-light.svg
logoUrlDark: https://my-app.bkper.app/images/logo-dark.svg

website: https://my-app.bkper.app
ownerName: Bkper
ownerLogoUrl: https://avatars.githubusercontent.com/u/11943086?v=4
ownerWebsite: https://bkper.com

developers: someuser *@yoursite.com
users: someuser *@yoursite.com

menuUrl: https://my-app.bkper.app?bookId=${book.id}
menuUrlDev: https://my-app-preview.bkper.app?bookId=${book.id}
menuOpenMode: SIDEBAR

webhookUrl: https://my-app.bkper.app/events
webhookUrlDev: https://my-app-preview.bkper.app/events
apiVersion: v5
events:
    - TRANSACTION_CHECKED

deployment:
    server: server/src/index.ts
    client: client
    services:
        - KV
    secrets: []
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

| Field        | Description                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `developers` | Who can update the app and deploy new versions. Accepts comma- or space-separated Bkper usernames and domain wildcards such as `*@yoursite.com`. |
| `users`      | Who can install and use the app. Uses the same format as `developers`; leave empty for public apps.                                              |

### Menu integration

| Field          | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `menuUrl`      | Production menu URL. Supports [variable substitution](#menu-url-variables). |
| `menuUrlDev`   | Development menu URL, typically a preview or local app URL.                 |
| `menuText`     | Custom menu text (defaults to app name).                                    |
| `menuOpenMode` | How the app menu opens: `SIDEBAR` (default), `EXPANDED`, or `NEW_TAB`.      |

`SIDEBAR` and `EXPANDED` Apps can receive live context updates while their iframe stays loaded. `NEW_TAB` Apps receive context only in the URL used to open the tab.

See [Context Menu](https://bkper.com/docs/build/apps/context-menu.md#live-context-updates) for menu URL configuration and live context updates.

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

| Field           | Description                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `webhookUrl`    | Production webhook URL for receiving events.                                        |
| `webhookUrlDev` | Development webhook URL (auto-updated by `bkper app dev`).                          |
| `apiVersion`    | API version for event payloads (currently `v5`).                                    |
| `events`        | List of [event types](https://bkper.com/docs/build/apps/event-handlers.md#event-types) to subscribe to. |

See [Event Handlers](https://bkper.com/docs/build/apps/event-handlers.md) for details on handling events.

### File patterns

| Field          | Description                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `filePatterns` | List of glob patterns (e.g., `*.ofx`, `*.csv`). When a matching file is uploaded, a `FILE_CREATED` event is triggered. |

### Properties schema

The `propertiesSchema` field defines autocomplete suggestions for custom properties in the Bkper UI, helping users discover the correct property keys and values for your app.

Suggested keys must follow the same custom property rules as user-entered keys, including the 30-character maximum after normalization.

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
| `deployment.server`             | TypeScript entry point for the single server Worker. It serves `/api/*`, `/events`, and static assets.                 |
| `deployment.client`             | Optional Vite/static client root. Built assets are deployed with the same Worker.                                      |
| `deployment.services`           | Platform services to provision. Currently: `KV` (key-value storage).                                                   |
| `deployment.secrets`            | Secret names used by the app. Managed via `bkper app secrets`.                                                         |
| `deployment.compatibility_date` | [Cloudflare Workers compatibility date](https://developers.cloudflare.com/workers/configuration/compatibility-dates/). |

See [Building & Deploying](https://bkper.com/docs/build/apps/deploying.md) for the full deployment workflow.
