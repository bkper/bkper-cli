# App Usage

Use the Apps installed in a Book, or available to install, to do work on it, instead of rebuilding what an App already does.

Apps are part of how a Book works. They react to its Events, read their settings from Custom Properties, act on the Book as their own users, and may offer an interface in the Book or an API. An App's own route keeps results consistent with what it does on its own, and it is the Book's established, auditable way to do that work.

All commands run as the signed-in user; Apps and Bkper enforce the user's Book permissions.

---

## Explore the Book's Apps

```bash
# Apps installed in a book
bkper app list -b abc123

# One App in full, including its readme
bkper app get exchange-bot
```

For each App, read:

-   `description` and, for a closer look, the readme from `app get` — what it does and how people use it.
-   `propertiesSchema` — the property keys it reads on the Book, Accounts, Groups, and Transactions.
-   `events` — the Book changes it reacts to.
-   `menuText` — its interface, opened from the Book's menu.

Match the `propertiesSchema` keys against the properties of the Book and its Accounts, Groups, and Transactions (`bkper book get`, `bkper account list`, `bkper group list`) to see which Apps are set up in this Book and how. Bot responses on events (`bkper event list -b <bookId>`) show what Apps have done.

## Find an App to install

When no installed App fits the task, look in the catalog:

```bash
# Apps you can install, most used first
bkper app list

# Read one App's readme before proposing it
bkper app get <appId>

# Install it (a change to the Book)
bkper app install <appId> -b <bookId>
```

Read the readme for the setup an App needs after installation, usually properties on the Book, Accounts, or Groups.

## Call an App's API

```bash
# The App's OpenAPI spec: operations, parameters, and schemas
bkper app api spec inventory-bot

# Read
bkper app api request exchange-bot "/api/v1/books/abc123/exchange-rates?date=2026-08-05"

# Send JSON data (POST unless -X says otherwise)
bkper app api request inventory-bot /api/v1/books/abc123/accounts/def456/calculate -d '{"date":"2026-08-31"}'

# Larger bodies via stdin
cat body.json | bkper app api request merge-duplicates /api/v1/analyze
```

-   Read the spec before calling. Use paths exactly as written there, filling path parameters with IDs obtained from Bkper.
-   Decide from each operation's summary, description, and schemas what it reads and what it changes in the Book. The HTTP method is a hint: GET usually only reads. When it is unclear whether an operation changes the Book, treat it as a change.
-   Not every App has an API. `app api spec` then reports `<appId> does not publish an OpenAPI spec`. Such Apps work through Book events, and through their interface when they have one (`menuText`).
-   A failed request exits with code 1 and `Error requesting app API: <status> <message>`, using the App's own error message.

---

<details>
<summary>Command reference</summary>

-   `app list` - List apps you have access to; readmes are omitted
    -   `-b, --book <bookId>` - List the apps installed in this book instead
-   `app get <appId>` - Get an app, including its readme
-   `app install <appId> -b <bookId>` - Install an app on a book
-   `app uninstall <appId> -b <bookId>` - Uninstall an app from a book
-   `app api spec <appId>` - Print the app's OpenAPI spec (`/openapi.json`)
    -   `-p, --preview` - Use the preview environment
-   `app api request <appId> <path>` - Send a request to the app's API (`/api/...` paths only), as the signed-in user, and print the response body
    -   `-X, --method <method>` - HTTP method (default: `GET`, or `POST` when data is sent)
    -   `-d, --data <json>` - JSON request body; without it, a body piped via stdin is sent
    -   `-p, --preview` - Use the preview environment

Requests go to `https://{appId}.bkper.app`, or `https://{appId}-preview.bkper.app` with `--preview`. Redirects are not followed. JSON responses print compact when piped and pretty in a terminal; other responses print as they are.

</details>
