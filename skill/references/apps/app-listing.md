# App Listing

All Bkper apps are listed on the Automations Portal at _[app.bkper.com](https://app.bkper.com/) > Automations > Apps_. Each app has its own page with logo, description, and details:

![App listing on the Automations Portal](https://bkper.com/docs/_astro/bkper-app-listing.BgcbAsjE.png)

App listings are populated from the fields you declare in [`bkper.yaml`](https://bkper.com/docs/platform/apps/configuration.md). Sync metadata changes with `bkper app sync`. Deploying code is a separate step.

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

See [App Configuration](https://bkper.com/docs/platform/apps/configuration.md) for the full `bkper.yaml` reference.

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
- **Quality review** — The implementation follows the [App Quality Guidelines](https://bkper.com/docs/platform/apps/quality.md)
- **Security review** — Event handlers are idempotent and include loop prevention
- **Listing quality** — The app has a clear name, description, logo, and user-facing documentation

### README matters

Your app's `README.md` is displayed to end users on the app listing page. Write it for the people who will install and use your app — not for developers.

**README should explain:**

- What the app does from a user's perspective
- How to use it (step-by-step for non-technical users)
- What features are available
- API access details when the app intentionally exposes `/api/*` routes for users or integrators

**API access details should stay concise:**

- App base URL for production and preview
- OpenAPI spec URL at `/openapi.json`
- One minimal authenticated example, such as a `curl` call with `Authorization: Bearer <token>`

**README should NOT contain:**

- Tech stack or architecture details
- Build commands or development setup
- Project structure or internal file paths
- Long API references, generated schemas, SDK internals, or route-by-route developer docs

Put developer documentation in `AGENTS.md` or internal docs instead. Keep `README.md` focused on the user experience and any integration entry points users need.

### Where published apps appear

Once published, your app appears in:

- **[bkper.com/apps](https://bkper.com/apps)** — The public app directory
- **Automations Portal** — Inside every Bkper book, users can find and install your app
