# bkper-js

> JavaScript/TypeScript client library for Bkper — classes, interfaces, and type definitions.

bkper-js library is a simple and secure way to access the [Bkper REST API](https://bkper.com/docs/api/rest) on Node.js and modern browsers.

It provides a set of classes and functions to interact with the Bkper API, including authentication, authorization, and data manipulation.

[![npm](https://img.shields.io/npm/v/bkper-js?color=%235889e4)](https://www.npmjs.com/package/bkper-js) [![GitHub](https://img.shields.io/badge/bkper%2Fbkper--js-blue?logo=github)](https://github.com/bkper/bkper-js)

### CDN / Browser

The simplest way to use bkper-js in a browser — no build tools, no npm, just a `<script>` tag and a valid access token. Works on **any domain**.

```html
<script src="https://cdn.jsdelivr.net/npm/bkper-js@2/dist/bkper.min.js"></script>
<script>
    const { Bkper } = bkperjs;

    async function listBooks(token) {
        Bkper.setConfig({
            oauthTokenProvider: async () => token,
        });
        const bkper = new Bkper();
        return await bkper.getBooks();
    }

    // Example: prompt for a token and list books
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('go').addEventListener('click', async () => {
            const token = document.getElementById('token').value;
            const books = await listBooks(token);
            document.getElementById('output').textContent = books.map(b => b.getName()).join('\n');
        });
    });
</script>

<input id="token" placeholder="Paste your access token" />
<button id="go">List Books</button>
<pre id="output"></pre>
```

Get an access token with the [Bkper CLI](https://www.npmjs.com/package/bkper):

```bash
bkper auth login   # one-time setup
bkper auth token   # prints a token (valid for 1 hour)
```

Pin to a specific version by replacing `@2` with e.g. `@2.31.0`.

### Node.js / CLI Scripts

For local scripts and CLI tools, use the [bkper](https://www.npmjs.com/package/bkper) CLI package for authentication:

```typescript
import { Bkper } from 'bkper-js';
import { getOAuthToken } from 'bkper';

// Configure with CLI authentication
Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
});

// Create Bkper instance
const bkper = new Bkper();

// Get a book and work with it
const book = await bkper.getBook('your-book-id');
console.log(`Book: ${book.getName()}`);

// List all books
const books = await bkper.getBooks();
console.log(`You have ${books.length} books`);
```

First, login via CLI: `bkper auth login`

### npm + Bundler

If you are using a bundler (Vite, webpack, esbuild, etc.), install from npm and provide an access token the same way as the CDN example:

```typescript
import { Bkper } from 'bkper-js';

Bkper.setConfig({
    oauthTokenProvider: async () => 'your-access-token',
});

const bkper = new Bkper();
const books = await bkper.getBooks();
```

### Web Applications on \*.bkper.app

> **Note:** `@bkper/web-auth` **only works on `*.bkper.app` subdomains**. Its session cookies are scoped to the `.bkper.app` domain and will not work on any other domain. For apps on other domains, use the [CDN / Browser](#cdn--browser) approach with an access token instead.

For apps hosted on `*.bkper.app` subdomains, use the [@bkper/web-auth](https://www.npmjs.com/package/@bkper/web-auth) SDK for built-in OAuth login flow:

```typescript
import { Bkper } from 'bkper-js';
import { BkperAuth } from '@bkper/web-auth';

// Initialize authentication
const auth = new BkperAuth({
    onLoginSuccess: () => initializeApp(),
    onLoginRequired: () => showLoginButton(),
});

// Restore session on app load
await auth.init();

// Configure Bkper with web auth
Bkper.setConfig({
    oauthTokenProvider: async () => auth.getAccessToken(),
});

// Create Bkper instance and use it
const bkper = new Bkper();
const books = await bkper.getBooks();
```

See the [@bkper/web-auth documentation](https://bkper.com/docs/auth-sdk) for more details.

### API Key (Optional)

API keys are optional and only needed for dedicated quota limits. If not provided, requests use a shared managed quota via the Bkper API proxy.

```typescript
Bkper.setConfig({
    oauthTokenProvider: async () => getOAuthToken(),
    apiKeyProvider: async () => process.env.BKPER_API_KEY, // Optional - for dedicated quota
});
```

## Classes

### Account *(extends ResourceProperty<bkper.Account>)*

This class defines an [Account](https://en.wikipedia.org/wiki/Account_(bookkeeping)) of a `Book`.

It maintains a balance of all amount [credited and debited](http://en.wikipedia.org/wiki/Debits_and_credits) in it by `Transactions`.

An Account can be grouped by `Groups`.

`Account` has no `getBalance()` method. To retrieve account balances, use
`Book.getBalancesReport` and read the resulting `BalancesContainer`.

**Constructor:** `new Account(book: Book, payload?: bkper.Account)`

**Properties:**

- `payload`: `bkper.Account` — The underlying payload data for this resource

**Methods:**

- `addGroup(group: bkper.Group | Group)` → `Account` — Adds a group to the Account.
- `create()` → `Promise<Account>` — Performs create new Account.
- `deleteProperty(key: string)` → `this` — Deletes a custom property.
- `getGroups()` / `setGroups(groups: Group[] | bkper.Group[])` → `Promise<Group[]> (set: Group[] | bkper.Group[])` — Gets the `Groups` of this Account.
- `getId()` → `string | undefined` — Gets the Account internal id.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the Account name.
- `getNormalizedName()` → `string` — Gets the normalized name of this Account without spaces or special characters.
- `getProperties()` / `setProperties(properties: { [key: string]: string })` → `{ [key: string]: string }` — Gets the custom properties stored in this resource.
- `getProperty(keys: string[])` / `setProperty(key: string, value: string | null | undefined)` → `string | undefined (set: string)` — Gets the property value for given keys. First property found will be retrieved.
- `getPropertyKeys()` → `string[]` — Gets the custom properties keys stored in this resource.
- `getType()` / `setType(type: AccountType)` → `AccountType` — Gets the type of this Account.
- `getVisibleProperties()` / `setVisibleProperties(properties: { [key: string]: string })` → `{ [key: string]: string }` — Gets the visible custom properties stored in this resource.
Hidden properties (those ending with "_") are excluded from the result.
- `hasTransactionPosted()` → `boolean | undefined` — Tells if the Account has any transaction already posted.
- `isArchived()` → `boolean | undefined` — Tells if this Account is archived.
- `isBalanceVerified()` → `boolean | undefined` — Tells if the balance of this Account has been verified/audited.
- `isCredit()` → `boolean | undefined` — Tells if the Account has a Credit nature or Debit otherwise.
- `isInGroup(group: string | Group)` → `Promise<boolean>` — Tells if this Account is in the `Group`.
- `isPermanent()` → `boolean | undefined` — Tells if the Account is permanent.
- `json()` → `bkper.Account` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Account>` — Performs delete Account.
- `removeGroup(group: string | Group)` → `Promise<Account>` — Removes a group from the Account.
- `setArchived(archived: boolean)` → `Account` — Sets Account archived/unarchived.
- `setVisibleProperty(key: string, value: string | null | undefined)` → `this` — Sets a custom property in this resource, filtering out hidden properties.
Hidden properties are those whose keys end with an underscore "_".
- `update()` → `Promise<Account>` — Performs update Account, applying pending changes.

**groups**

When groups are already embedded in the account payload (e.g. from
`Bkper.getBook` with includeGroups), resolves them from the
book's cache instead of making API calls.

**hasTransactionPosted**

Accounts with transaction posted, even with zero balance, can only be archived.

**isCredit**

Credit Accounts are just for representation purposes. It increase or decrease the absolute balance. It doesn't affect the overall balance or the behavior of the system.

The absolute balance of credit Accounts increase when it participate as a credit/origin in a transaction. Its usually for Accounts that increase the balance of the assets, like revenue Accounts.

```
        Crediting a credit
  Thus ---------------------> Account increases its absolute balance
        Debiting a debit


        Debiting a credit
  Thus ---------------------> Account decreases its absolute balance
        Crediting a debit
```

As a rule of thumb, and for simple understanding, almost all Accounts are Debit nature (NOT credit), except the ones that "offers" amount for the books, like revenue Accounts.

**isPermanent**

Permanent Accounts are the ones which final balance is relevant and keep its balances over time.

They are also called [Real Accounts](http://en.wikipedia.org/wiki/Account_(Accountancy)#Based_on_periodicity_of_flow)

Usually represents assets or tangibles, capable of being perceived by the senses or the mind, like bank Accounts, money, debts and so on.

### AccountsDataTableBuilder

A AccountsDataTableBuilder is used to setup and build two-dimensional arrays containing accounts.

**Constructor:** `new AccountsDataTableBuilder(accounts: Account[])`

**Methods:**

- `archived(include: boolean)` → `AccountsDataTableBuilder` — Defines whether the archived accounts should be included.
- `build()` → `Promise<any[][]>` — Builds a two-dimensional array containing all accounts.
- `groups(include: boolean)` → `AccountsDataTableBuilder` — Defines whether include account groups.
- `hiddenProperties(include: boolean)` → `AccountsDataTableBuilder` — Defines whether to include hidden properties (keys ending with underscore "_").
- `ids(include: boolean)` → `AccountsDataTableBuilder` — Defines whether include account ids.
- `properties(include: boolean)` → `AccountsDataTableBuilder` — Defines whether include custom account properties.

### Agent

Defines an Agent on Bkper.

An Agent represents an entity (such as an App or Bot) that interacts with Bkper, executing actions on behalf of users.

**Constructor:** `new Agent(payload?: bkper.Agent)`

**Properties:**

- `payload`: `bkper.Agent`

**Methods:**

- `getId()` → `string | undefined` — Gets the Agent universal identifier.
- `getLogoUrl()` → `string | undefined` — Gets the Agent logo URL.
- `getLogoUrlDark()` → `string | undefined` — Gets the Agent logo URL in dark mode.
- `getName()` → `string | undefined` — Gets the Agent name.
- `json()` → `bkper.Agent` — Gets the wrapped plain JSON object.

### Amount

This class defines an Amount for arbitrary-precision decimal arithmetic.

It inherits methods from [big.js](http://mikemcl.github.io/big.js/) library

**Constructor:** `new Amount(n: string | number | Amount)`

The Amount constructor.

**Methods:**

- `abs()` → `Amount` — Returns an absolute Amount.
- `cmp(n: string | number | Amount)` → `-1 | 0 | 1` — Compares this Amount with another value.
- `div(n: string | number | Amount)` → `Amount` — Divides this Amount by another value.
- `eq(n: string | number | Amount)` → `boolean` — Checks if this Amount equals another value.
- `gt(n: string | number | Amount)` → `boolean` — Checks if this Amount is greater than another value.
- `gte(n: string | number | Amount)` → `boolean` — Checks if this Amount is greater than or equal to another value.
- `lt(n: string | number | Amount)` → `boolean` — Checks if this Amount is less than another value.
- `lte(n: string | number | Amount)` → `boolean` — Checks if this Amount is less than or equal to another value.
- `minus(n: string | number | Amount)` → `Amount` — Subtracts another value from this Amount.
- `mod(n: string | number | Amount)` → `Amount` — Calculates the modulo (remainder) of dividing this Amount by another value.
- `plus(n: string | number | Amount)` → `Amount` — Adds another value to this Amount.
- `round(dp?: number)` → `Amount` — Rounds this Amount to a maximum of dp decimal places.
- `times(n: string | number | Amount)` → `Amount` — Multiplies this Amount by another value.
- `toFixed(dp?: number)` → `string` — Returns a string representing the value of this Amount in normal notation to a fixed number of decimal places.
- `toNumber()` → `number` — Returns a primitive number representing the value of this Amount.
- `toString()` → `string` — Returns a string representing the value of this Amount.

**mod**

Similar to % operator

### App *(extends Resource<bkper.App>)*

Defines an App on Bkper.

Apps can be installed on Books by users.

**Constructor:** `new App(payload?: bkper.App, config?: Config)`

**Properties:**

- `payload`: `bkper.App` — The underlying payload data for this resource

**Methods:**

- `create()` → `Promise<App>` — Performs the app creation, applying pending changes.
- `getDescription()` → `string | undefined` — Gets the description of this App.
- `getDevelopers()` / `setDevelopers(developers?: string)` → `string | undefined (set: string)` — Gets the developers (usernames and domain patterns).
- `getEvents()` → `EventType[] | undefined` — Gets the events bound to this App.
- `getFilePatterns()` → `string[] | undefined` — Gets the file patterns the App handles.
- `getId()` → `string | undefined` — Gets the App universal identifier.
- `getLogoUrl()` → `string | undefined` — Gets the logo url of this App.
- `getLogoUrlDark()` → `string | undefined` — Gets the logo url of this App in dark mode.
- `getMenuPopupHeight()` → `string | undefined` — Gets the menu popup height of this App.
- `getMenuPopupWidth()` → `string | undefined` — Gets the menu popup width of this App.
- `getMenuText()` → `string | undefined` — Gets the menu text of this App.
- `getMenuUrl()` → `string | undefined` — Gets the menu url of this App.
- `getMenuUrlDev()` → `string | undefined` — Gets the menu development url of this App.
- `getName()` → `string | undefined` — Gets the name of this App.
- `getOwnerLogoUrl()` → `string | undefined` — Gets the logo url of the owner of this App.
- `getOwnerName()` → `string | undefined` — Gets the name of the owner of this App.
- `getOwnerWebsiteUrl()` → `string | undefined` — Gets the website url of the owner of this App.
- `getReadme()` / `setReadme(readme?: string)` → `string | undefined (set: string)` — Gets the readme.md file as text.
- `getRepositoryUrl()` → `string | undefined` — Gets the repository url of this App.
- `getUsers()` / `setUsers(users?: string)` → `string | undefined (set: string)` — Gets the whitelisted users (usernames and domain patterns).
- `getWebsiteUrl()` → `string | undefined` — Gets the website url of this App.
- `hasEvents()` → `boolean` — Checks if this App has events bound to it.
- `isInstallable()` → `boolean` — Tells if this App is installable.
- `isPublished()` → `boolean` — Checks if this App is published.
- `isRepositoryPrivate()` → `boolean | undefined` — Tells if the repository is private.
- `json()` → `bkper.App` — Gets an immutable copy of the JSON payload for this resource.
- `setClientSecret(clientSecret?: string)` → `App` — Sets the client secret.
- `setWebhookUrlDev(webhookUrlDev: string)` → `App` — Sets the webhook url for development.
- `update()` → `Promise<App>` — Performs a full update of the App, applying pending changes.

**create**

The App id MUST be unique. If another app is already existing, an error will be thrown.

### Backlog *(extends Resource<bkper.Backlog>)*

This class defines the Backlog of a `Book`.

A Backlog is a list of pending tasks in a Book

**Constructor:** `new Backlog(payload?: bkper.Backlog, config?: Config)`

**Properties:**

- `payload`: `bkper.Backlog` — The underlying payload data for this resource

**Methods:**

- `getCount()` → `number | undefined` — Returns the number of pending tasks in this Backlog.
- `json()` → `bkper.Backlog` — Gets an immutable copy of the JSON payload for this resource.

### Balance

Class that represents an `Account` or `Group` balance on a window of time (Day / Month / Year).

**Constructor:** `new Balance(container: BalancesContainer, balancePlain: bkper.Balance)`

**Properties:**

- `payload`: `bkper.Balance`

**Methods:**

- `getCumulativeBalance()` → `Amount` — The cumulative balance to the date, based on the credit nature of the container
- `getCumulativeBalanceRaw()` → `Amount` — The raw cumulative balance to the date.
- `getCumulativeCredit()` → `Amount` — The cumulative credit to the date.
- `getCumulativeDebit()` → `Amount` — The cumulative debit to the date.
- `getDate()` → `Date` — Date object constructed based on `Book` time zone offset. Usefull for
- `getDay()` → `number` — The day of the balance. Days starts on 1 to 31.
- `getFuzzyDate()` → `number` — The Fuzzy Date of the balance, based on `Periodicity` of the `BalancesReport` query, composed by Year, Month and Day.
- `getMonth()` → `number` — The month of the balance. Months starts on 1 (January) to 12 (December)
- `getPeriodBalance()` → `Amount` — The balance on the date period, based on credit nature of the container.
- `getPeriodBalanceRaw()` → `Amount` — The raw balance on the date period.
- `getPeriodCredit()` → `Amount` — The credit on the date period.
- `getPeriodDebit()` → `Amount` — The debit on the date period.
- `getYear()` → `number` — The year of the balance

**getDate**

If Month or Day is zero, the date will be constructed with first Month (January) or Day (1) of the next period.

**getDay**

Day can be 0 (zero) in case of Monthly or Early `Periodicity` of the `BalancesReport`

**getFuzzyDate**

The format is **YYYYMMDD**. Very usefull for ordering and indexing

Month and Day can be 0 (zero), depending on the granularity of the `Periodicity`.

*Example:*

**20180125** - 25, January, 2018 - DAILY Periodicity

**20180100** - January, 2018 - MONTHLY Periodicity

**20180000** - 2018 - YEARLY Periodicity

**getMonth**

Month can be 0 (zero) in case of Early `Periodicity` of the `BalancesReport`

### BalancesDataTableBuilder *(implements BalancesDataTableBuilder)*

A BalancesDataTableBuilder is used to setup and build two-dimensional arrays containing balance information.

**Constructor:** `new BalancesDataTableBuilder(book: Book, balancesContainers: BalancesContainer[], periodicity: Periodicity)`

**Methods:**

- `build()` → `any[][]` — Builds an two-dimensional array with the balances.
- `expanded(expanded: number | boolean)` → `BalancesDataTableBuilder` — Defines whether Groups should expand its child accounts.
- `formatDates(format: boolean)` → `BalancesDataTableBuilder` — Defines whether the dates should be ISO formatted YYYY-MM-DD. E.g. 2025-01-01
- `formatValues(format: boolean)` → `BalancesDataTableBuilder` — Defines whether the value should be formatted based on decimal separator of the `Book`.
- `hiddenProperties(include: boolean)` → `BalancesDataTableBuilder` — Defines whether to include hidden properties (keys ending with underscore "_").
- `hideDates(hide: boolean)` → `BalancesDataTableBuilder` — Defines whether the dates should be hidden for **PERIOD** or **CUMULATIVE** `BalanceType`.
- `hideNames(hide: boolean)` → `BalancesDataTableBuilder` — Defines whether the `Accounts` and `Groups` names should be hidden.
- `period(period: boolean)` → `BalancesDataTableBuilder` — Defines whether should force use of period balances for **TOTAL** `BalanceType`.
- `properties(include: boolean)` → `BalancesDataTableBuilder` — Defines whether include custom `Accounts` and `Groups` properties.
- `raw(raw: boolean)` → `BalancesDataTableBuilder` — Defines whether should show raw balances, no matter the credit nature of the Account or Group.
- `transposed(transposed: boolean)` → `BalancesDataTableBuilder` — Defines whether should rows and columns should be transposed.
- `trial(trial: boolean)` → `BalancesDataTableBuilder` — Defines whether should split **TOTAL** `BalanceType` into debit and credit.
- `type(type: BalanceType)` → `BalancesDataTableBuilder` — Fluent method to set the `BalanceType` for the builder.

**expanded**

true to expand itself
-1 to expand all subgroups
-2 to expand all accounts
0 to expand nothing
1 to expand itself and its first level of children
2 to expand itself and its first two levels of children
etc.

**transposed**

For **TOTAL** `BalanceType`, the **transposed** table looks like:

```
  _____________________________
 |  Expenses | Income  |  ...  |
 | -4568.23  | 5678.93 |  ...  |
 |___________|_________|_______|

```
Two rows, and each `Account` or `Group` per column.


For **PERIOD** or **CUMULATIVE** `BalanceType`, the **transposed** table will be a time table, and the format looks like:

```
  _______________________________________________________________
 |            | Expenses   | Income     |     ...    |    ...    |
 | 15/01/2014 | -2345.23   |  3452.93   |     ...    |    ...    |
 | 15/02/2014 | -2345.93   |  3456.46   |     ...    |    ...    |
 | 15/03/2014 | -2456.45   |  3567.87   |     ...    |    ...    |
 |     ...    |     ...    |     ...    |     ...    |    ...    |
 |____________|____________|____________|____________|___________|

```

First column will be each Date, and one column for each `Account` or `Group`.

### BalancesReport

Class representing a Balance Report, generated when calling [Book.getBalanceReport](#book_getbalancesreport)

**Constructor:** `new BalancesReport(book: Book, payload: bkper.Balances)`

**Properties:**

- `payload`: `bkper.Balances`

**Methods:**

- `createDataTable()` → `BalancesDataTableBuilder` — Creates a BalancesDataTableBuilder to generate a two-dimensional array with all `BalancesContainers`.
- `getBalancesContainer(name: string)` → `BalancesContainer` — Gets a specific `BalancesContainer`.
- `getBalancesContainers()` → `BalancesContainer[]` — Gets all `BalancesContainers` of the report.
- `getBook()` → `Book` — Gets the `Book` that generated the report.
- `getPeriodicity()` → `Periodicity` — Gets the `Periodicity` of the query used to generate the report.

### Billing *(extends Resource<bkper.Billing>)*

This class defines the Billing information for a `User`.

The Billing information includes the plan, the admin email, and the billing portal URL.

**Constructor:** `new Billing(json?: bkper.Billing, config?: Config)`

**Properties:**

- `payload`: `bkper.Billing` — The underlying payload data for this resource

**Methods:**

- `getAdminEmail()` → `string | undefined` — Gets the admin email for this User's billing account.
- `getCheckoutUrl(plan: string, successUrl?: string, cancelUrl?: string, cycle?: string)` → `Promise<string | undefined>` — Gets the URL to redirect the User to the billing checkout.
- `getCounts()` → `Promise<bkper.Counts>` — Gets the transaction counts associated to the User's billing account.
- `getDaysLeftInTrial()` → `number | undefined` — Gets the number of days left in User's trial period.
- `getEmail()` → `string | undefined` — Gets the email for the User.
- `getHostedDomain()` → `string | undefined` — Gets the hosted domain for the User.
- `getPlan()` → `string | undefined` — Gets the current plan of the User.
- `getPortalUrl(returnUrl: string)` → `Promise<string | undefined>` — Gets the URL to redirect the User to the billing portal.
- `getTotalTransactionsThisMonth()` → `number | undefined` — Gets the number of total transactions this month for the User's billing account.
- `getTotalTransactionsThisYear()` → `number | undefined` — Gets the number of total transactions this year for the User's billing account.
- `hasStartedTrial()` → `boolean | undefined` — Tells if the User has started the trial period.
- `isEnabled()` → `boolean | undefined` — Tells if billing is enabled for the User.
- `isPlanOverdue()` → `boolean | undefined` — Tells if the User's current plan payment is overdue.
- `json()` → `bkper.Billing` — Gets an immutable copy of the JSON payload for this resource.

### Bkper

This is the main entry point of the [bkper-js](https://www.npmjs.com/package/bkper-js) library.

You can configure the library in two ways:

1. Using static configuration (traditional approach):

```typescript
Bkper.setConfig({
  apiKeyProvider: () => process.env.BKPER_API_KEY,
  oauthTokenProvider: () => process.env.BKPER_OAUTH_TOKEN
});

const bkper = new Bkper();
const book = await bkper.getBook('bookId');
```

2. Using per-instance configuration (recommended for Cloudflare Workers):

```typescript
const bkper = new Bkper({
  apiKeyProvider: () => process.env.BKPER_API_KEY,
  oauthTokenProvider: () => process.env.BKPER_OAUTH_TOKEN
});

const book = await bkper.getBook('bookId');
```

**Constructor:** `new Bkper(config?: Config)`

Creates a new Bkper instance with the provided configuration.

**Methods:**

- `getApp(id: string)` → `Promise<App>` — Gets the `App` with the specified id.
- `getApps()` → `Promise<App[]>` — Gets all `Apps` available for the user.
- `getBook(id: string, includeAccounts?: boolean, includeGroups?: boolean)` → `Promise<Book>` — Gets the `Book` with the specified bookId from url param.
- `getBooks(query?: string)` → `Promise<Book[]>` — Gets all `Books` the user has access to.
- `getCollections()` → `Promise<Collection[]>` — Gets all `Collections` the user has access to.
- `getConfig()` → `Config` — Gets the current instance configuration.
- `getTemplates()` → `Promise<Template[]>` — Gets all `Templates` available for the user.
- `getUser()` → `Promise<User>` — Gets the current logged `User`.
- `static setConfig(config: Config)` → `void` — Sets the global API configuration for all Bkper operations.

**setConfig**

WARNING: This configuration will be shared and should NOT be used on shared environments.

### BkperError *(extends Error)*

Standard error class for Bkper API errors.
Extends Error to enable instanceof checks and standard error handling.

**Constructor:** `new BkperError(code: number, message: string, reason?: string)`

**Properties:**

- `readonly code`: `number` — HTTP status code (e.g., 404, 400, 500)
- `message`: `string`
- `name`: `string`
- `readonly reason?`: `string` — Machine-readable reason (e.g., "notFound", "badRequest")
- `stack?`: `string`
- `static prepareStackTrace?`: `(err: Error, stackTraces: __global.NodeJS.CallSite[]) => any` — Optional override for formatting stack traces
- `static stackTraceLimit`: `number`

**Methods:**

- `static captureStackTrace(targetObject: object, constructorOpt?: Function)` → `void` — Create .stack property on a target object

### Book *(extends ResourceProperty<bkper.Book>)*

A Book represents a [General Ledger](https://en.wikipedia.org/wiki/General_ledger) for a company or business, but can also represent a [Ledger](https://en.wikipedia.org/wiki/Ledger) for a project or department

It contains all `Accounts` where `Transactions` are recorded/posted;

**Constructor:** `new Book(payload?: bkper.Book, config?: Config)`

**Properties:**

- `payload`: `bkper.Book` — The underlying payload data for this resource

**Methods:**

- `audit()` → `void` — Trigger [Balances Audit](https://help.bkper.com/en/articles/4412038-balances-audit) async process.
- `batchCheckTransactions(transactions: Transaction[])` → `Promise<void>` — Batch check `Transactions` on the Book.
- `batchCreateAccounts(accounts: Account[])` → `Promise<Account[]>` — Create `Accounts` on the Book, in batch.
- `batchCreateGroups(groups: Group[])` → `Promise<Group[]>` — Create `Groups` on the Book, in batch.
- `batchCreateTransactions(transactions: Transaction[])` → `Promise<Transaction[]>` — Batch create `Transactions` on the Book.
- `batchPostTransactions(transactions: Transaction[])` → `Promise<void>` — Batch post `Transactions` on the Book.
- `batchReplayEvents(events: Event[], errorOnly?: boolean)` → `Promise<void>` — Replay `Events` on the Book, in batch.
- `batchTrashTransactions(transactions: Transaction[], trashChecked?: boolean)` → `Promise<void>` — Batch trash `Transactions` on the Book.
- `batchUncheckTransactions(transactions: Transaction[])` → `Promise<void>` — Batch uncheck `Transactions` on the Book.
- `batchUntrashTransactions(transactions: Transaction[])` → `Promise<void>` — Batch untrash `Transactions` on the Book.
- `batchUpdateTransactions(transactions: Transaction[], updateChecked?: boolean)` → `Promise<Transaction[]>` — Batch update `Transactions` on the Book.
- `copy(name: string, copyTransactions?: boolean, fromDate?: number)` → `Promise<Book>` — Creates a copy of this Book
- `countTransactions(query?: string)` → `Promise<number | undefined>` — Retrieve the number of transactions based on a query.
- `create()` → `Promise<Book>` — Performs create new Book.
- `createAccountsDataTable(accounts?: Account[])` → `Promise<AccountsDataTableBuilder>` — Create a `AccountsDataTableBuilder`, to build two dimensional Array representations of `Account` dataset.
- `createGroupsDataTable(groups?: Group[])` → `Promise<GroupsDataTableBuilder>` — Create a `GroupsDataTableBuilder`, to build two dimensional Array representations of `Group` dataset.
- `createIntegration(integration: bkper.Integration | Integration)` → `Promise<Integration>` — Creates a new `Integration` in the Book.
- `createTransactionsDataTable(transactions: Transaction[], account?: Account)` → `TransactionsDataTableBuilder` — Create a `TransactionsDataTableBuilder`, to build two dimensional Array representations of `Transaction` dataset.
- `formatDate(date: Date, timeZone?: string)` → `string` — Formats a date according to date pattern of the Book.
- `formatValue(value: number | Amount | null | undefined)` → `string` — Formats a value according to `DecimalSeparator` and fraction digits of the Book.
- `getAccount(idOrName?: string)` → `Promise<Account | undefined>` — Gets an `Account` object by id or name.
- `getAccounts()` → `Promise<Account[]>` — Gets all `Accounts` of this Book with full account-group relationships.
- `getApps()` → `Promise<App[]>` — Retrieve installed `Apps` for this Book.
- `getAutoPost()` / `setAutoPost(autoPost: boolean)` → `boolean | undefined (set: boolean)` — Gets the auto post status of the Book.
- `getBacklog()` → `Promise<Backlog>` — Gets the Backlog of this Book.
- `getBalancesReport(query: string)` → `Promise<BalancesReport>` — Create a `BalancesReport` based on query.
- `getClosingDate()` / `setClosingDate(closingDate: string | null)` → `string | undefined (set: string | null)` — Gets the closing date of the Book in ISO format yyyy-MM-dd.
- `getCollaborators()` → `Promise<Collaborator[]>` — Gets all collaborators of this Book.
- `getCollection()` → `Collection | undefined` — Gets the collection of this Book, if any.
- `getDatePattern()` / `setDatePattern(datePattern: string)` → `string` — Gets the date pattern of the Book.
- `getDecimalPlaces()` → `number | undefined` — Gets the number of decimal places supported by this Book.
- `getDecimalSeparator()` / `setDecimalSeparator(decimalSeparator: DecimalSeparator)` → `DecimalSeparator` — Gets the decimal separator of the Book.
- `getFile(id: string)` → `Promise<File | undefined>` — Retrieve a file by id.
- `getFractionDigits()` / `setFractionDigits(fractionDigits: number)` → `number | undefined (set: number)` — Gets the number of fraction digits supported by this Book.
- `getGroup(idOrName?: string)` → `Promise<Group | undefined>` — Gets a `Group` object by id or name.
- `getGroups()` → `Promise<Group[]>` — Gets all `Groups` of this Book with complete parent/child hierarchy.
- `getId()` → `string` — Gets the unique identifier of this Book.
- `getIntegrations()` → `Promise<Integration[]>` — Gets the existing `Integrations` in the Book.
- `getLastUpdateMs()` → `number | undefined` — Gets the last update date of the book, in milliseconds.
- `getLockDate()` / `setLockDate(lockDate: string | null)` → `string | undefined (set: string | null)` — Gets the lock date of the Book in ISO format yyyy-MM-dd.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the name of this Book.
- `getOwnerName()` → `string | undefined` — Gets the name of the owner of the Book.
- `getPageSize()` / `setPageSize(pageSize: number)` → `number | undefined (set: number)` — Gets the transactions pagination page size.
- `getPeriod()` / `setPeriod(period: Period)` → `Period` — Gets the period slice for balances visualization.
- `getPeriodStartMonth()` / `setPeriodStartMonth(month: Month)` → `Month` — Gets the start month when YEAR period is set.
- `getPermission()` → `Permission` — Gets the permission for the current user in this Book.
- `getSavedQueries()` → `Promise<Query[]>` — Gets the saved queries from this book.
- `getTimeZone()` / `setTimeZone(timeZone: string)` → `string | undefined (set: string)` — Gets the time zone of the Book.
- `getTimeZoneOffset()` → `number | undefined` — Gets the time zone offset of the book, in minutes.
- `getTotalTransactions()` → `number` — Gets the total number of posted transactions.
- `getTotalTransactionsCurrentMonth()` → `number` — Gets the total number of posted transactions on current month.
- `getTotalTransactionsCurrentYear()` → `number` — Gets the total number of posted transactions on current year.
- `getTransaction(id: string)` → `Promise<Transaction | undefined>` — Retrieve a transaction by id.
- `getVisibility()` / `setVisibility(visibility: Visibility)` → `Visibility` — Gets the visibility of the book.
- `json()` → `bkper.Book` — Gets an immutable copy of the JSON payload for this resource.
- `listEvents(afterDate: string | null, beforeDate: string | null, onError: boolean, resourceId: string | null, limit: number, cursor?: string)` → `Promise<EventList>` — Lists events in the Book based on the provided parameters.
- `listTransactions(query?: string, limit?: number, cursor?: string)` → `Promise<TransactionList>` — Lists transactions in the Book based on the provided query, limit, and cursor, for pagination.
- `parseDate(date: string)` → `Date` — Parse a date string according to date pattern and timezone of the Book. Also parse ISO yyyy-mm-dd format.
- `parseValue(value: string)` → `Amount | undefined` — Parse a value string according to `DecimalSeparator` and fraction digits of the Book.
- `remove()` → `Promise<Book>` — Warning!
- `round(value: number | Amount)` → `Amount` — Rounds a value according to the number of fraction digits of the Book.
- `update()` → `Promise<Book>` — Perform update Book, applying pending changes.
- `updateIntegration(integration: bkper.Integration)` → `Promise<Integration>` — Updates an existing `Integration` in the Book.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

**getAccount**

Results are cached to avoid repeated server calls. Account-group relationships
are included if the full chart was loaded via getAccounts() or when the Book
was loaded with includeAccounts=true.

```typescript
// Get individual account (basic data, cached)
const account = await book.getAccount('Bank Account');

// For account-group relationships, use one of these approaches:
// Option 1: Load book with full data upfront
const bookWithAccounts = await Bkper.getBook(bookId, true);
const accountWithGroups = await bookWithAccounts.getAccount('Bank Account');

// Option 2: Load full chart when needed
await book.getAccounts();
const accountWithGroups2 = await book.getAccount('Bank Account');
```

**getAccounts**

Results are cached for performance. Groups are automatically loaded first
to ensure proper linking. Consider using Bkper.getBook(id, true) for
upfront loading when you know you'll need all accounts.

```typescript
// Load all accounts with complete relationships
const accounts = await book.getAccounts();

// Alternative: Load book with accounts upfront (more efficient)
const bookWithAccounts = await Bkper.getBook(bookId, true);
const accounts2 = await bookWithAccounts.getAccounts(); // Already cached
```

**getBalancesReport**

The balances report

Example:

```js
var book = BkperApp.getBook("agtzfmJrcGVyLWhyZHITCxIGTGVkZ2VyGICAgPXjx7oKDA");

var balancesReport = book.getBalancesReport("group:'Equity' after:7/2018 before:8/2018");

var accountBalance = balancesReport.getBalancesContainer("Bank Account").getCumulativeBalance();
```

**getGroup**

Results are cached to avoid repeated server calls. Parent/child relationships
are included if all groups were loaded via getGroups() or when the Book was
loaded with includeGroups=true.

```typescript
// Get individual group (basic data, cached)
const group = await book.getGroup('Assets');

// For parent/child relationships, use one of these approaches:
// Option 1: Load book with full hierarchy upfront
const bookWithGroups = await Bkper.getBook(bookId, false, true);
const groupWithTree = await bookWithGroups.getGroup('Assets');

// Option 2: Load full hierarchy when needed
await book.getGroups();
const groupWithTree2 = await book.getGroup('Assets');
console.log(groupWithTree2.getParent(), groupWithTree2.getChildren());
```

**getGroups**

Results are cached for performance. Group tree relationships are built
during loading. Consider using Bkper.getBook(id, false, true) for
upfront loading when you know you'll need all groups.

```typescript
// Load all groups with complete hierarchy
const groups = await book.getGroups();

// Alternative: Load book with groups upfront (more efficient)
const bookWithGroups = await Bkper.getBook(bookId, false, true);
const groups2 = await bookWithGroups.getGroups(); // Already cached
```

**remove**

Deletes this Book and all its data (transactions, accounts, groups). Book owner only.

### BooksDataTableBuilder

A BooksDataTableBuilder is used to setup and build two-dimensional arrays containing books.

**Constructor:** `new BooksDataTableBuilder(books: Book[])`

**Methods:**

- `build()` → `any[][]` — Builds a two-dimensional array containing all Books.
- `hiddenProperties(include: boolean)` → `BooksDataTableBuilder` — Defines whether to include hidden properties (keys ending with underscore "_").
- `ids(include: boolean)` → `BooksDataTableBuilder` — Defines whether to include book ids.
- `properties(include: boolean)` → `BooksDataTableBuilder` — Defines whether to include custom book properties.

### BotResponse

This class defines a Bot Response associated to an `Event`.

**Constructor:** `new BotResponse(event: Event, payload?: bkper.BotResponse)`

**Properties:**

- `payload`: `bkper.BotResponse`

**Methods:**

- `getAgentId()` → `string | undefined` — Gets the agent id of this Bot Response.
- `getCreatedAt()` → `Date | undefined` — Gets the date this Bot Response was created.
- `getEvent()` → `Event` — Gets the Event this Bot Response is associated to.
- `getMessage()` → `string | undefined` — Gets the message of this Bot Response.
- `getType()` → `BotResponseType | undefined` — Gets the type of this Bot Response.
- `remove()` → `Promise<BotResponse>` — Delete this Bot Response.
- `replay()` → `Promise<BotResponse>` — Replay this Bot Response.

### Collaborator *(extends Resource<bkper.Collaborator>)*

This class defines a Collaborator of a `Book`.

A Collaborator represents a user that has been granted access to a Book with specific permissions.

**Constructor:** `new Collaborator(book: Book, payload?: bkper.Collaborator)`

**Properties:**

- `payload`: `bkper.Collaborator` — The underlying payload data for this resource

**Methods:**

- `create(message?: string)` → `Promise<Collaborator>` — Performs create new Collaborator.
- `getEmail()` / `setEmail(email: string)` → `string | undefined (set: string)` — Gets the Collaborator email address.
- `getId()` → `string | undefined` — Gets the Collaborator internal id.
- `getPermission()` / `setPermission(permission: Permission)` → `Permission | undefined (set: Permission)` — Gets the permission level of the Collaborator.
- `json()` → `bkper.Collaborator` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Collaborator>` — Performs remove Collaborator.
- `update()` → `Promise<Collaborator>` — Performs update Collaborator.

### Collection *(extends Resource<bkper.Collection>)*

This class defines a Collection of `Books`.

**Constructor:** `new Collection(payload?: bkper.Collection, config?: Config)`

**Properties:**

- `payload`: `bkper.Collection` — The underlying payload data for this resource

**Methods:**

- `addBooks(books: Book[])` → `Promise<Book[]>` — Adds Books to this Collection.
- `create()` → `Promise<Collection>` — Performs create new Collection.
- `getBooks()` → `Book[]` — Gets all Books of this collection.
- `getId()` → `string | undefined` — Gets the unique identifier of this Collection.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the name of this Collection.
- `getOwnerUsername()` → `string | undefined` — Gets the username of the owner of this Collection
- `getPermission()` → `Permission | undefined` — Gets the user permission for this Collection
- `getUpdatedAt()` → `string | undefined` — Gets the last update date of this Collection
- `json()` → `bkper.Collection` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Book[]>` — Performs delete Collection.
- `removeBooks(books: Book[])` → `Promise<Book[]>` — Removes Books from this Collection.
- `update()` → `Promise<Collection>` — Performs update Collection, applying pending changes.

### Connection *(extends ResourceProperty<bkper.Connection>)*

This class defines a Connection from an `User` to an external service.

**Constructor:** `new Connection(payload?: bkper.Connection, config?: Config)`

**Properties:**

- `payload`: `bkper.Connection` — The underlying payload data for this resource

**Methods:**

- `clearTokenProperties()` → `void` — Cleans any token property stored in the Connection.
- `create()` → `Promise<Connection>` — Performs create new Connection.
- `getAgentId()` / `setAgentId(agentId: string)` → `string | undefined (set: string)` — Gets the agentId of the Connection.
- `getDateAddedMs()` → `string | undefined` — Gets the date when the Connection was added.
- `getEmail()` → `string | undefined` — Gets the email of the owner of the Connection.
- `getId()` → `string | undefined` — Gets the id of the Connection.
- `getIntegrations()` → `Promise<Integration[]>` — Gets the existing `Integrations` on the Connection.
- `getLogo()` → `string | undefined` — Gets the logo of the Connection.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the name of the Connection.
- `getType()` / `setType(type: "APP" | "BANK")` → `"APP" | "BANK" | undefined (set: "APP" | "BANK")` — Gets the type of the Connection.
- `getUUID()` / `setUUID(uuid: string)` → `string | undefined (set: string)` — Gets the universal unique identifier of this Connection.
- `json()` → `bkper.Connection` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Connection>` — Performs remove Connection.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

### Event

This class defines an Event from a `Book`.

An event is an object that represents an action (such as posting or deleting a `Transaction`) made by an actor (such as a user or a [Bot](https://bkper.com/apps) acting on behalf of a user).

**Constructor:** `new Event(book: Book, payload?: bkper.Event)`

**Properties:**

- `payload`: `bkper.Event`

**Methods:**

- `getAgent()` → `Agent | undefined` — Gets the Agent who performed the Event.
- `getBook()` → `Book` — Gets the book in which the Event was created.
- `getBotResponses()` → `BotResponse[]` — Gets the Bot Responses associated to this Event.
- `getCreatedAt()` → `Date | undefined` — Gets the date the Event was created.
- `getId()` → `string | undefined` — Gets the id of the Event.
- `getType()` → `EventType | undefined` — Gets the type of the Event.
- `getUser()` → `User | undefined` — Gets the user who performed the Event.
- `hasErrorResponse()` → `boolean` — Checks if this Event has at least one Bot Response of type ERROR.
- `json()` → `bkper.Event` — Gets an immutable copy of the JSON payload for this Event.

### EventList

A list associated with an event query.

**Constructor:** `new EventList(book: Book, payload: bkper.EventList)`

**Methods:**

- `getCursor()` → `string | undefined` — Gets the cursor associated with the query for pagination.
- `getFirst()` → `Event | undefined` — Gets the first Event in the list.
- `getItems()` → `Event[]` — Get the events in the list.
- `size()` → `number` — Get the total number of events in the list.

### File *(extends ResourceProperty<bkper.File>)*

This class defines a File uploaded to a `Book`.

A File can be attached to a `Transaction` or used to import data.

**Constructor:** `new File(book: Book, payload?: bkper.File)`

**Properties:**

- `payload`: `bkper.File` — The underlying payload data for this resource

**Methods:**

- `create()` → `Promise<File>` — Perform create new File.
- `getBook()` → `Book` — Gets the Book this File belongs to.
- `getContent()` / `setContent(content: string)` → `Promise<string | undefined> (set: string)` — Gets the file content Base64 encoded.
- `getContentType()` / `setContentType(contentType: string)` → `string | undefined (set: string)` — Gets the File content type.
- `getId()` → `string | undefined` — Gets the File id.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the File name.
- `getSize()` → `number | undefined` — Gets the file size in bytes.
- `getUrl()` → `string | undefined` — Gets the file serving url for accessing via browser.
- `json()` → `bkper.File` — Gets an immutable copy of the JSON payload for this resource.
- `update()` → `Promise<File>` — Perform update File, applying pending changes.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

### Group *(extends ResourceProperty<bkper.Group>)*

This class defines a Group of `Accounts`.

Accounts can be grouped by different meaning, like Expenses, Revenue, Assets, Liabilities and so on

Its useful to keep organized and for high level analysis.

**Constructor:** `new Group(book: Book, payload?: bkper.Group)`

**Properties:**

- `payload`: `bkper.Group` — The underlying payload data for this resource

**Methods:**

- `create()` → `Promise<Group>` — Performs create new group.
- `getAccounts()` → `Promise<Account[]>` — Gets all Accounts of this group.
- `getChildren()` → `Group[]` — Gets the children of the Group.
- `getDepth()` → `number` — Gets the depth of the Group in the hierarchy.
- `getDescendants()` → `Set<Group>` — Gets all descendant Groups of the current Group.
- `getDescendantTreeIds()` → `Set<string>` — Gets the IDs of all descendant Groups in a tree structure.
- `getId()` → `string | undefined` — Gets the id of this Group.
- `getName()` / `setName(name: string)` → `string | undefined (set: string)` — Gets the name of this Group.
- `getNormalizedName()` → `string` — Gets the normalized name of this group without spaces and special characters.
- `getParent()` / `setParent(group: Group | null | undefined)` → `Group | undefined (set: Group | null | undefined)` — Gets the parent Group.
- `getRoot()` → `Group` — Gets the root Group of the current Group.
- `getRootName()` → `string` — Gets the name of the root Group.
- `getType()` → `AccountType` — Gets the type of the accounts of this group.
- `hasAccounts()` → `boolean | undefined` — Tells if this group has any account in it.
- `hasChildren()` → `boolean` — Checks if the Group has any children.
- `hasParent()` → `boolean` — Checks if the Group has a parent.
- `isBalanceVerified()` → `Promise<boolean | undefined>` — Tells if the balance of this Group has been verified/audited.
- `isCredit()` → `boolean | undefined` — Tells if this is a credit (Incoming and Liabilities) group.
- `isHidden()` → `boolean | undefined` — Tells if the Group is hidden on main transactions menu.
- `isLeaf()` → `boolean` — Checks if the Group is a leaf node (i.e., has no children).
- `isLocked()` → `boolean` — Tells if the Group is locked by the Book owner.
- `isMixed()` → `boolean | undefined` — Tells if this is a mixed (Assets/Liabilities or Incoming/Outgoing) group.
- `isPermanent()` → `boolean | undefined` — Tells if the Group is permanent.
- `isRoot()` → `boolean` — Checks if the Group is a root node (i.e., has no parent).
- `json()` → `bkper.Group` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Group>` — Performs delete group.
- `setHidden(hidden: boolean)` → `Group` — Hide/Show group on main menu.
- `setLocked(locked: boolean)` → `Group` — Sets the locked state of the Group.
- `update()` → `Promise<Group>` — Performs update group, applying pending changes.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

### GroupsDataTableBuilder

A GroupsDataTableBuilder is used to setup and build two-dimensional arrays containing groups.

**Constructor:** `new GroupsDataTableBuilder(groups: Group[])`

**Methods:**

- `build()` → `any[][]` — Builds a two-dimensional array containing all Groups.
- `hiddenProperties(include: boolean)` → `GroupsDataTableBuilder` — Defines whether to include hidden properties (keys ending with underscore "_").
- `ids(include: boolean)` → `GroupsDataTableBuilder` — Defines whether include group ids.
- `properties(include: boolean)` → `GroupsDataTableBuilder` — Defines whether include custom group properties.
- `tree(enable: boolean)` → `GroupsDataTableBuilder` — Defines whether to render groups as an indented tree instead of flat rows with a Parent column.

### Integration *(extends ResourceProperty<bkper.Integration>)*

This class defines a Integration from an `User` to an external service.

**Constructor:** `new Integration(payload?: bkper.Integration, config?: Config)`

**Properties:**

- `payload`: `bkper.Integration` — The underlying payload data for this resource

**Methods:**

- `getAddedBy()` → `string | undefined` — Gets the name of the user who added the Integration.
- `getAgentId()` → `string | undefined` — Gets the agent id of the Integration.
- `getBookId()` → `string | undefined` — Gets the `Book` id of the Integration.
- `getDateAddedMs()` → `string | undefined` — Gets the date when the Integration was added.
- `getId()` → `string | undefined` — Gets the id of the Integration.
- `getLastUpdateMs()` → `string | undefined` — Gets the date when the Integration was last updated.
- `getLogo()` → `string | undefined` — ~~Deprecated: Use getLogoUrl instead.~~ Gets the logo of the Integration.
- `getLogoUrl()` → `string | undefined` — Gets the logo url of this Integration.
- `getLogoUrlDark()` → `string | undefined` — Gets the logo url of this Integration in dark mode.
- `getName()` → `string | undefined` — Gets the name of the Integration.
- `json()` → `bkper.Integration` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Integration>` — Performs remove Integration.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

### Query *(extends Resource<bkper.Query>)*

Defines a saved Query in a `Book`.

Queries can be saved on Books by users.

**Constructor:** `new Query(book: Book, payload?: bkper.Query)`

**Properties:**

- `payload`: `bkper.Query` — The underlying payload data for this resource

**Methods:**

- `create()` → `Promise<Query>` — Perform create new Query.
- `getId()` → `string | undefined` — Gets the Query universal identifier.
- `getQuery()` / `setQuery(query: string)` → `string | undefined (set: string)` — Gets the query string to be executed.
- `getTitle()` / `setTitle(title: string)` → `string | undefined (set: string)` — Gets the title of this saved Query.
- `json()` → `bkper.Query` — Gets an immutable copy of the JSON payload for this resource.
- `remove()` → `Promise<Query>` — Perform delete Query.
- `update()` → `Promise<Query>` — Perform update Query, applying pending changes.

### Template *(extends Resource<bkper.Template>)*

This class defines a Template.

A Template is a pre-configured setup for `Books` and associated Google Sheets that provides users with a starting point for specific accounting or financial management needs.

**Constructor:** `new Template(json?: bkper.Template, config?: Config)`

**Properties:**

- `payload`: `bkper.Template` — The underlying payload data for this resource

**Methods:**

- `getBookId()` → `string | undefined` — Gets the bookId of the `Book` associated with the Template.
- `getBookLink()` → `string | undefined` — Gets the link of the `Book` associated with the Template.
- `getCategory()` → `string | undefined` — Gets the category of the Template.
- `getDescription()` → `string | undefined` — Gets the description of the Template.
- `getImageUrl()` → `string | undefined` — Gets the url of the image of the Template.
- `getName()` → `string | undefined` — Gets the name of the Template.
- `getSheetsLink()` → `string | undefined` — Gets the link of the Google Sheets spreadsheet associated with the Template.
- `getTimesUsed()` → `number` — Gets the times the Template has been used.
- `json()` → `bkper.Template` — Gets an immutable copy of the JSON payload for this resource.

### Transaction *(extends ResourceProperty<bkper.Transaction>)*

This class defines a Transaction between [credit and debit](http://en.wikipedia.org/wiki/Debits_and_credits) `Accounts`.

A Transaction is the main entity on the [Double Entry](http://en.wikipedia.org/wiki/Double-entry_bookkeeping_system) [Bookkeeping](http://en.wikipedia.org/wiki/Bookkeeping) system.

**Constructor:** `new Transaction(book: Book, payload?: bkper.Transaction)`

**Properties:**

- `payload`: `bkper.Transaction` — The underlying payload data for this resource

**Methods:**

- `addFile(file: File)` → `Transaction` — Adds a file attachment to the Transaction.
- `addRemoteId(remoteId: string)` → `Transaction` — Add a remote id to the Transaction.
- `addUrl(url: string)` → `Transaction` — Add a url to the Transaction. Url starts with https://
- `check()` → `Promise<Transaction>` — Perform check transaction.
- `create()` → `Promise<Transaction>` — Perform create new draft transaction.
- `from(account: bkper.Account | Account | null | undefined)` → `Transaction` — Sets the credit/origin `Account` of this Transaction. Same as setCreditAccount()
- `getAccountBalance(raw?: boolean)` → `Promise<Amount | undefined>` — Gets the balance that the `Account` has at that day, when listing transactions of that Account.
- `getAgentId()` → `string | undefined` — Gets the unique identifier of the agent that created this transaction.
- `getAgentLogoUrl()` → `string | undefined` — Gets the logo URL of the agent that created this transaction.
- `getAgentLogoUrlDark()` → `string | undefined` — Gets the dark mode logo URL of the agent that created this transaction.
- `getAgentName()` → `string | undefined` — Gets the name of the agent that created this transaction.
- `getAmount()` / `setAmount(amount: string | number | Amount)` → `Amount | undefined (set: string | number | Amount)` — Gets the amount of this Transaction.
- `getAmountFormatted()` → `string | undefined` — Gets the formatted amount of this Transaction according to the Book format.
- `getBook()` → `Book` — Gets the book associated with this transaction.
- `getCreatedAt()` → `Date` — Gets the date when the transaction was created.
- `getCreatedAtFormatted()` → `string` — Gets the formatted creation date of the transaction.
- `getCreatedBy()` → `string | undefined` — Gets the username of the user who created the transaction.
- `getCreditAccount()` / `setCreditAccount(account: bkper.Account | Account | null | undefined)` → `Promise<Account | undefined> (set: bkper.Account | Account | null | undefined)` — Gets the credit account associated with this Transaction. Same as origin account
- `getCreditAccountName()` → `Promise<string | undefined>` — Gets the name of this Transaction's credit account.
- `getCreditAmount(account: string | Account)` → `Promise<Amount | undefined>` — Get the absolute amount of this Transaction if the given account is at the credit side.
- `getDate()` / `setDate(date: string | Date)` → `string | undefined (set: string | Date)` — Gets the transaction date in ISO format.
- `getDateFormatted()` → `string | undefined` — Gets the transaction date formatted according to the book's date pattern.
- `getDateObject()` → `Date` — Gets the transaction date as a Date object in the book's timezone.
- `getDateValue()` → `number | undefined` — Gets the transaction date as a numeric value.
- `getDebitAccount()` / `setDebitAccount(account: bkper.Account | Account | null | undefined)` → `Promise<Account | undefined> (set: bkper.Account | Account | null | undefined)` — Gets the debit account associated with this Transaction. Same as destination account
- `getDebitAccountName()` → `Promise<string | undefined>` — Gets the name of this Transaction's debit account.
- `getDebitAmount(account: string | Account)` → `Promise<Amount | undefined>` — Gets the absolute amount of this Transaction if the given account is at the debit side.
- `getDescription()` / `setDescription(description: string)` → `string` — Gets the description of this Transaction.
- `getFiles()` → `File[]` — Gets all files attached to the transaction.
- `getId()` → `string | undefined` — Gets the unique identifier of the transaction.
- `getOtherAccount(account: string | Account)` → `Promise<Account | undefined>` — Gets the `Account` at the other side of the transaction given the one in one side.
- `getOtherAccountName(account: string | Account)` → `Promise<string | undefined>` — The Account name at the other side of this Transaction given the one in one side.
- `getRemoteIds()` → `string[]` — Gets the remote IDs associated with this transaction. Remote ids are used to avoid duplication.
- `getStatus()` → `TransactionStatus` — Gets the status of the transaction.
- `getTags()` → `string[]` — Gets all hashtags used in the transaction.
- `getUpdatedAt()` → `Date` — Gets the date when the transaction was last updated.
- `getUpdatedAtFormatted()` → `string` — Gets the formatted last update date of the transaction.
- `getUrls()` / `setUrls(urls: string[])` → `string[]` — Gets all URLs associated with the transaction.
- `hasTag(tag: string)` → `boolean` — Check if the transaction has the specified tag.
- `isChecked()` → `boolean | undefined` — Checks if the transaction is marked as checked.
- `isCredit(account?: Account)` → `Promise<boolean>` — Tell if the given account is credit on this Transaction
- `isDebit(account?: Account)` → `Promise<boolean>` — Tell if the given account is debit on the Transaction
- `isLocked()` → `boolean` — Checks if the transaction is locked by the book's lock or closing date.
- `isPosted()` → `boolean | undefined` — Checks if the transaction has been posted to the accounts.
- `isTrashed()` → `boolean | undefined` — Checks if the transaction is in the trash.
- `json()` → `bkper.Transaction` — Gets an immutable copy of the JSON payload for this resource.
- `post()` → `Promise<Transaction>` — Perform post transaction, changing credit and debit `Account` balances.
- `removeFile(file: File)` → `Transaction` — Removes a file attachment from the Transaction.
- `setChecked(checked: boolean)` → `Transaction` — Set the check state of the Transaction.
- `to(account: bkper.Account | Account | null | undefined)` → `Transaction` — Sets the debit/destination `Account` of this Transaction. Same as setDebitAccount()
- `trash()` → `Promise<Transaction>` — Trash the transaction.
- `uncheck()` → `Promise<Transaction>` — Perform uncheck transaction.
- `untrash()` → `Promise<Transaction>` — Untrash the transaction.
- `update()` → `Promise<Transaction>` — Update transaction, applying pending changes.

*Standard property methods (deleteProperty, getProperties, getProperty, getPropertyKeys, getVisibleProperties, setProperties, setProperty, setVisibleProperties, setVisibleProperty) — see Account.*

**addFile**

Files not previously created in the Book will be automatically created when the transaction is persisted.

**getAccountBalance**

Evolved balances is returned when searching for transactions of a permanent `Account`.

Only comes with the last posted transaction of the day.

### TransactionList

A list associated with a transaction query.

**Constructor:** `new TransactionList(book: Book, payload: bkper.TransactionList)`

**Methods:**

- `getAccount()` → `Promise<Account | undefined>` — Retrieves the account associated with the query, when filtering by account.
- `getCursor()` → `string | undefined` — Gets the cursor associated with the query for pagination.
- `getFirst()` → `Transaction | undefined` — Gets the first Transaction in the list.
- `getItems()` → `Transaction[]` — Gets the transactions in the list.
- `size()` → `number` — Gets the total number of transactions in the list.

### TransactionsDataTableBuilder

A TransactionsDataTableBuilder is used to setup and build two-dimensional arrays containing transactions.

**Constructor:** `new TransactionsDataTableBuilder(book: Book, transactions: Transaction[], account?: Account)`

**Methods:**

- `build()` → `Promise<any[][]>` — Builds a two-dimensional array containing all transactions.
- `formatDates(format: boolean)` → `TransactionsDataTableBuilder` — Defines whether the dates should be formatted, based on date pattern of the `Book`.
- `formatValues(format: boolean)` → `TransactionsDataTableBuilder` — Defines whether amounts should be formatted based on `DecimalSeparator` of the `Book`.
- `getAccount()` → `Account | undefined` — Gets the account used to filter transactions, when applicable.
- `hiddenProperties(include: boolean)` → `TransactionsDataTableBuilder` — Defines whether to include hidden properties (keys ending with underscore "_").
- `ids(include: boolean)` → `TransactionsDataTableBuilder` — Defines whether to include transaction ids and remote ids.
- `includeIds(include: boolean)` → `TransactionsDataTableBuilder` — ~~Deprecated: Use `ids` instead.~~
- `includeProperties(include: boolean)` → `TransactionsDataTableBuilder` — ~~Deprecated: Use `properties` instead.~~
- `includeUrls(include: boolean)` → `TransactionsDataTableBuilder` — ~~Deprecated: Use `urls` instead.~~
- `properties(include: boolean)` → `TransactionsDataTableBuilder` — Defines whether to include custom transaction properties.
- `recordedAt(include: boolean)` → `TransactionsDataTableBuilder` — Defines whether to include the "Recorded at" column.
- `urls(include: boolean)` → `TransactionsDataTableBuilder` — Defines whether to include attachments and url links.

### User *(extends Resource<bkper.User>)*

This class defines a User on the Bkper platform.

Users can own and collaborate on `Books`, manage `Collections`, and connect to external services through `Connections`.

Each User has a unique identity, subscription plan details, and access permissions across the platform.

**Constructor:** `new User(payload?: bkper.User, config?: Config)`

**Properties:**

- `payload`: `bkper.User` — The underlying payload data for this resource

**Methods:**

- `getAvatarUrl()` → `string | undefined` — Gets the avatar url of the User.
- `getBilling()` → `Promise<Billing>` — Gets the billing information for this User.
- `getConnection(id: string)` → `Promise<Connection>` — Gets a `Connection` of the User.
- `getConnections()` → `Promise<Connection[]>` — Gets the `Connections` of the User.
- `getEmail()` → `string | undefined` — Gets the email of the User.
- `getFullName()` → `string | undefined` — Gets the full name of the User.
- `getGivenName()` → `string | undefined` — Gets the given name of the User.
- `getHostedDomain()` → `string | undefined` — Gets the hosted domain of the User.
- `getId()` → `string | undefined` — Gets the id of the User.
- `getName()` → `string | undefined` — Gets the name of the User.
- `getUsername()` → `string | undefined` — Gets the username of the User.
- `hasUsedConnections()` → `boolean | undefined` — Tells if the User has already used `Connections`.
- `json()` → `bkper.User` — Gets an immutable copy of the JSON payload for this resource.

## Interfaces

### BalancesContainer

The container of balances of an `Account` or `Group`

The container is composed of a list of `Balances` for a window of time, as well as its period and cumulative totals.

**Properties:**

- `getAccount`: `() => Promise<Account | null>` — Gets the `Account` associated with this container.
- `getBalances`: `() => Balance[]` — Gets all `Balances` of the container
- `getBalancesContainer`: `(name: string) => BalancesContainer` — Gets a specific `BalancesContainer`.
- `getBalancesContainers`: `() => BalancesContainer[]` — Gets all child `BalancesContainers`.
- `getBalancesReport`: `() => BalancesReport` — Gets the parent `BalancesReport` of the container.
- `getCumulativeBalance`: `() => Amount` — Gets the cumulative balance to the date.
- `getCumulativeBalanceRaw`: `() => Amount` — Gets the cumulative raw balance to the date.
- `getCumulativeBalanceRawText`: `() => string` — Gets the cumulative raw balance formatted according to `Book` decimal format and fraction digits.
- `getCumulativeBalanceText`: `() => string` — Gets the cumulative balance formatted according to `Book` decimal format and fraction digits.
- `getDepth`: `() => number` — Gets the depth in the parent chain up to the root.
- `getGroup`: `() => Promise<Group | null>` — Gets the `Group` associated with this container.
- `getName`: `() => string` — Gets the `Account` or `Group` name.
- `getNormalizedName`: `() => string` — Gets the `Account` or `Group` name without spaces or special characters.
- `getParent`: `() => BalancesContainer | null` — Gets the parent BalanceContainer.
- `getPeriodBalance`: `() => Amount` — Gets the balance on the date period.
- `getPeriodBalanceRaw`: `() => Amount` — Gets the raw balance on the date period.
- `getPeriodBalanceRawText`: `() => string` — Gets the raw balance on the date period formatted according to `Book` decimal format and fraction digits.
- `getPeriodBalanceText`: `() => string` — Gets the balance on the date period formatted according to `Book` decimal format and fraction digits.
- `hasGroupBalances`: `() => boolean` — Gets whether the balance container is from a parent group.
- `isCredit`: `() => boolean | undefined` — Gets the credit nature of the BalancesContainer, based on `Account` or `Group`.
- `isFromAccount`: `() => boolean` — Gets whether this balance container is from an `Account`.
- `isFromGroup`: `() => boolean` — Gets whether this balance container is from a `Group`.
- `isPermanent`: `() => boolean` — Tell if this balance container is permanent, based on the `Account` or `Group`.
- `payload`: `bkper.AccountBalances | bkper.GroupBalances`

**Methods:**

- `createDataTable()` → `BalancesDataTableBuilder` — Creates a BalancesDataTableBuilder to generate a two-dimensional array with all `BalancesContainers`
- `getCumulativeCredit()` → `Amount` — The cumulative credit to the date.
- `getCumulativeCreditText()` → `string` — The cumulative credit formatted according to `Book` decimal format and fraction digits.
- `getCumulativeDebit()` → `Amount` — The cumulative debit to the date.
- `getCumulativeDebitText()` → `string` — The cumulative credit formatted according to `Book` decimal format and fraction digits.
- `getPeriodCredit()` → `Amount` — The credit on the date period.
- `getPeriodCreditText()` → `string` — The credit on the date period formatted according to `Book` decimal format and fraction digits
- `getPeriodDebit()` → `Amount` — The debit on the date period.
- `getPeriodDebitText()` → `string` — The debit on the date period formatted according to `Book` decimal format and fraction digits
- `getProperties()` → `{ [key: string]: string }` — Gets the custom properties stored in this Account or Group.
- `getProperty(keys: string[])` → `string | undefined` — Gets the property value for given keys. First property found will be retrieved
- `getPropertyKeys()` → `string[]` — Gets the custom properties keys stored in the associated `Account` or `Group`.

**getBalancesContainers**

**NOTE**: Only for Group balance containers. Accounts returns null.

**isCredit**

For `Account`, the credit nature will be the same as the one from the Account.

For `Group`, the credit nature will be the same, if all accounts containing on it has the same credit nature. False if mixed.

**isPermanent**

Permanent are the ones which final balance is relevant and keep its balances over time.

They are also called [Real Accounts](http://en.wikipedia.org/wiki/Account_(accountancy)#Based_on_periodicity_of_flow).

Usually represents assets or liabilities, capable of being perceived by the senses or the mind, like bank accounts, money, debts and so on.

### Config

This class defines the `Bkper` API Config.

**Properties:**

- `agentIdProvider?`: `() => Promise<string | undefined>` — Provides the agent ID to identify the calling agent for attribution purposes.
- `apiKeyProvider?`: `() => Promise<string>` — Optional API key for dedicated quota limits.
- `oauthTokenProvider?`: `() => Promise<string | undefined>` — Issue a valid OAuth2 access token with **https://www.googleapis.com/auth/userinfo.email** scope authorized.
- `requestErrorHandler?`: `(error: any) => any` — Custom request error handler
- `requestHeadersProvider?`: `() => Promise<{ [key: string]: string }>` — Provides additional headers to append to the API request
- `requestRetryHandler?`: `(status?: number, error?: any, attempt?: number) => Promise<void>` — Custom request retry handler.

**agentIdProvider**

This ID is sent via the `bkper-agent-id` header with each API request,
allowing the server to attribute actions to the correct agent.

**apiKeyProvider**

If not provided, requests use a shared managed quota via the Bkper API proxy.
Use your own API key for dedicated quota limits and project-level usage tracking.

API keys are for project identification only, not for authentication or agent attribution.
Agent attribution is handled separately via the `agentIdProvider`.

**requestRetryHandler**

This function is called when a request fails and needs to be retried.
It provides the HTTP status code, error message, and the number of retry attempts made so far.

## Enums

### AccountType

Enum that represents account types.

- `ASSET` — Asset account type
- `INCOMING` — Incoming account type
- `LIABILITY` — Liability account type
- `OUTGOING` — Outgoing account type

### BalanceType

Enum that represents balance types.

- `CUMULATIVE` — Cumulative balance
- `PERIOD` — Period balance
- `TOTAL` — Total balance

### BotResponseType

Enum that represents the type of a Bot Response

- `ERROR` — Error bot response
- `INFO` — Info bot response
- `WARNING` — Warning bot response

### DecimalSeparator

Decimal separator of numbers on book

- `COMMA` — ,
- `DOT` — .

### EventType

Enum that represents event types.

- `ACCOUNT_CREATED`
- `ACCOUNT_DELETED`
- `ACCOUNT_UPDATED`
- `BOOK_DELETED`
- `BOOK_UPDATED`
- `COLLABORATOR_ADDED`
- `COLLABORATOR_REMOVED`
- `COLLABORATOR_UPDATED`
- `COMMENT_CREATED`
- `COMMENT_DELETED`
- `FILE_CREATED`
- `FILE_UPDATED`
- `GROUP_CREATED`
- `GROUP_DELETED`
- `GROUP_UPDATED`
- `INTEGRATION_CREATED`
- `INTEGRATION_DELETED`
- `INTEGRATION_UPDATED`
- `QUERY_CREATED`
- `QUERY_DELETED`
- `QUERY_UPDATED`
- `TRANSACTION_CHECKED`
- `TRANSACTION_CREATED`
- `TRANSACTION_DELETED`
- `TRANSACTION_POSTED`
- `TRANSACTION_RESTORED`
- `TRANSACTION_UNCHECKED`
- `TRANSACTION_UPDATED`

### Month

Enum that represents a Month.

- `APRIL`
- `AUGUST`
- `DECEMBER`
- `FEBRUARY`
- `JANUARY`
- `JULY`
- `JUNE`
- `MARCH`
- `MAY`
- `NOVEMBER`
- `OCTOBER`
- `SEPTEMBER`

### Period

Enum that represents a period slice.

- `MONTH` — Monthly period
- `QUARTER` — Quarterly period
- `YEAR` — Yearly period

### Periodicity

The Periodicity of the query. It may depend on the level of granularity you write the range params.

- `DAILY` — Example: after:25/01/1983, before:04/03/2013, after:$d-30, before:$d, after:$d-15/$m
- `MONTHLY` — Example: after:jan/2013, before:mar/2013, after:$m-1, before:$m
- `YEARLY` — Example: on:2013, after:2013, $y

### Permission

Enum representing permissions of user in the Book

- `EDITOR` — Manage accounts, transactions, book configuration and sharing
- `NONE` — No permission
- `OWNER` — Manage everything, including book visibility and deletion. Only one owner per book.
- `POSTER` — View transactions, accounts, record and delete drafts
- `RECORDER` — Record and delete drafts only. Useful to collect data only
- `VIEWER` — View transactions, accounts and balances.

### TransactionStatus

Enum that represents the status of a Transaction.

- `CHECKED` — Transaction is posted and checked
- `DRAFT` — Transaction is a draft, not yet posted
- `TRASHED` — Transaction is in the trash
- `UNCHECKED` — Transaction is posted but not checked

### Visibility

Enum representing the visibility of a Book

- `PRIVATE` — The book can be accessed by the owner and collaborators
- `PUBLIC` — The book can be accessed by anyone with the link

