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

Use `menuUrlDev` to keep developer testing separate from production. The app template points it to the preview deployment:

```yaml
menuUrl: https://my-app.bkper.app?bookId=${book.id}&query=${transactions.query}
menuUrlDev: https://my-app-preview.bkper.app?bookId=${book.id}&query=${transactions.query}
```

During local development, you can instead point it to the local Worker URL at `http://localhost:8787`. The development URL is used when an app developer clicks the menu item.

### Menu open mode

Control how the menu opens with `menuOpenMode`:

```yaml
menuOpenMode: SIDEBAR
```

| Mode       | Behavior                                                              |
| ---------- | --------------------------------------------------------------------- |
| `SIDEBAR`  | Opens in a narrow side panel (default).                               |
| `EXPANDED` | Opens in a wider panel with more room for complex UIs.                |
| `NEW_TAB`  | Opens the menu URL in a new browser tab instead of an embedded panel. |

### Available expressions

The menu URL supports these dynamic expressions:

| Expression              | Description               |
| ----------------------- | ------------------------- |
| `${book.id}`            | The current Book ID       |
| `${transactions.query}` | The current query string  |
| `${account.id}`         | The selected account ID   |
| `${account.name}`       | The selected account name |
| `${group.id}`           | The selected group ID     |
| `${group.name}`         | The selected group name   |

For the full list of accepted expressions, see the [Menu URL variables](https://bkper.com/docs/build/apps/configuration.md#menu-url-variables) reference.
