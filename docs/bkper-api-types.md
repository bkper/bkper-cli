# bkper-api-types

> TypeScript type definitions for the Bkper API — shared interfaces and enumerations.

This package contains Typescript definitions for the [Bkper REST API](https://bkper.com/docs/#rest-api).

The types are generated based on the Bkper [Open API spec](https://bkper.com/docs/api/rest/openapi.json) using the [dtsgenerator](https://github.com/horiuchi/dtsgenerator) tool.

More information at the [Bkper Developer Documentation](https://bkper.com/docs/#rest-api)

[![npm (scoped)](https://img.shields.io/npm/v/@bkper/bkper-api-types?color=%235889e4)](https://www.npmjs.com/package/@bkper/bkper-api-types) [![GitHub](https://img.shields.io/badge/bkper%2Fbkper--api--types-blue?logo=github)](https://github.com/bkper/bkper-api-types)

### 2) Configure tsconfig.json:

```
{
    "compilerOptions": {
        "typeRoots" : ["node_modules/@bkper", "node_modules/@types" ]
    }
}
```

[Learn more](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html#types-typeroots-and-types) about **@types**, **typeRoots** and **types**

## Interfaces

### Account

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `archived?`: `boolean` — Archived accounts are kept for history
- `balance?`: `string` — The running balance of the account at the transaction date.
- `balanceVerified?`: `boolean` — Whether the account balance has been verified/audited
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `credit?`: `boolean` — Credit nature or Debit otherwise
- `groups?`: `bkper.Group[]` — The groups of the account
- `hasTransactionPosted?`: `boolean` — Whether the account has any transactions posted
- `id?`: `string` — The unique id that identifies the Account in the Book
- `name?`: `string` — The name of the Account
- `normalizedName?`: `string` — The name of the Account, lowercase, without spaces or special characters
- `permanent?`: `boolean` — Permanent are such as bank accounts, customers or the like
- `properties?`: `{ [name: string]: string }` — The key/value custom properties of the Account
- `type?`: `"ASSET" | "LIABILITY" | "INCOMING" | "OUTGOING"` — The type of the account
- `updatedAt?`: `string` — The last update timestamp, in milliseconds

### AccountBalances

**Properties:**

- `archived?`: `boolean`
- `balances?`: `bkper.Balance[]`
- `credit?`: `boolean`
- `cumulativeBalance?`: `string`
- `cumulativeCredit?`: `string`
- `cumulativeDebit?`: `string`
- `empty?`: `boolean`
- `name?`: `string`
- `normalizedName?`: `string`
- `periodBalance?`: `string`
- `periodCredit?`: `string`
- `periodDebit?`: `string`
- `permanent?`: `boolean`
- `properties?`: `{ [name: string]: string }`

### AccountList

**Properties:**

- `items?`: `bkper.Account[]` — List items

### Agent

**Properties:**

- `id?`: `string` — The agent id
- `logo?`: `string` — The agent logo. Public url or Base64 encoded
- `logoDark?`: `string` — The agent logo on dark mode. Public url or Base64 encoded
- `name?`: `string` — The agent name

### App

**Properties:**

- `apiVersion?`: `"v0" | "v1" | "v2" | "v3" | "v4" | "v5"` — The API version of the event payload
- `clientId?`: `string` — The Google OAuth Client ID
- `clientSecret?`: `string` — The Google OAuth Client Secret
- `connectable?`: `boolean` — Whether this app is connectable by a user
- `deprecated?`: `boolean` — Whether the app is deprecated
- `description?`: `string` — The App description
- `developers?`: `string` — The developers (usernames and domain patterns), comma or space separated
- `events?`: `("FILE_CREATED" | "FILE_UPDATED" | "TRANSACTION_CREATED" | "TRANSACTION_UPDATED" | "TRANSACTION_DELETED" | "TRANSACTION_POSTED" | "TRANSACTION_CHECKED" | "TRANSACTION_UNCHECKED" | "TRANSACTION_RESTORED" | "ACCOUNT_CREATED" | "ACCOUNT_UPDATED" | "ACCOUNT_DELETED" | "QUERY_CREATED" | "QUERY_UPDATED" | "QUERY_DELETED" | "GROUP_CREATED" | "GROUP_UPDATED" | "GROUP_DELETED" | "COMMENT_CREATED" | "COMMENT_DELETED" | "COLLABORATOR_ADDED" | "COLLABORATOR_UPDATED" | "COLLABORATOR_REMOVED" | "INTEGRATION_CREATED" | "INTEGRATION_UPDATED" | "INTEGRATION_DELETED" | "BOOK_CREATED" | "BOOK_AUDITED" | "BOOK_UPDATED" | "BOOK_DELETED")[]` — Event types the App listen to
- `filePatterns?`: `string[]` — File patterns the App handles - wildcard accepted. E.g. *.pdf, *-bank.csv
- `id?`: `string` — The unique agent id of the App - this can't be changed after created
- `installable?`: `boolean` — Whether this app is installable in a book
- `logoUrl?`: `string` — The App logo url
- `logoUrlDark?`: `string` — The App logo url in dark mode
- `menuPopupHeight?`: `string` — The menu popup window height
- `menuPopupWidth?`: `string` — The menu popup window width
- `menuText?`: `string` — The contex menu text - default to the App name
- `menuUrl?`: `string` — The context menu url
- `menuUrlDev?`: `string` — The context menu url in dev mode
- `name?`: `string` — The App name
- `ownerEmail?`: `string` — The owner user email
- `ownerId?`: `string` — The owner user id
- `ownerLogoUrl?`: `string` — The owner company logo url
- `ownerName?`: `string` — The owner company name
- `ownerWebsite?`: `string` — The owner company website url
- `propertiesSchema?`: `bkper.AppPropertiesSchema`
- `published?`: `boolean` — Whether this app is already published
- `readme?`: `string` — The readme.md file as string
- `readmeMd?`: `string` — The readme.md file as raw markdown string
- `repoPrivate?`: `boolean` — Whether the code repository is private
- `repoUrl?`: `string` — The code repository url
- `scopes?`: `string[]` — The Google OAuth Scopes used by the app
- `users?`: `string` — The users (usernames and domain patterns) to enable the App while not yet published
- `webhookUrl?`: `string` — The Webhook endpoint URL to listen for book events
- `webhookUrlDev?`: `string` — The Webhook endpoint URL to listen for book events in dev mode
- `website?`: `string` — The App website url

### AppList

**Properties:**

- `items?`: `bkper.App[]`

### AppPropertiesSchema

**Properties:**

- `account?`: `bkper.AppPropertySchema`
- `book?`: `bkper.AppPropertySchema`
- `group?`: `bkper.AppPropertySchema`
- `transaction?`: `bkper.AppPropertySchema`

### AppPropertySchema

**Properties:**

- `keys?`: `string[]` — The property keys schema
- `values?`: `string[]` — The property values schema

### Backlog

**Properties:**

- `count?`: `number`

### Balance

**Properties:**

- `cumulativeBalance?`: `string`
- `cumulativeCredit?`: `string`
- `cumulativeDebit?`: `string`
- `day?`: `number`
- `fuzzyDate?`: `number`
- `month?`: `number`
- `periodBalance?`: `string`
- `periodCredit?`: `string`
- `periodDebit?`: `string`
- `year?`: `number`

### Balances

**Properties:**

- `accountBalances?`: `bkper.AccountBalances[]`
- `balancesUrl?`: `string`
- `groupBalances?`: `bkper.GroupBalances[]`
- `nextRange?`: `string`
- `periodicity?`: `"DAILY" | "MONTHLY" | "YEARLY"`
- `previousRange?`: `string`
- `range?`: `string`
- `rangeBeginLabel?`: `string`
- `rangeEndLabel?`: `string`

### Billing

**Properties:**

- `adminEmail?`: `string` — The billing admin email for the user's billing account
- `daysLeftInTrial?`: `number` — How many days the user has left in the trial period
- `email?`: `string` — The user's email address
- `enabled?`: `boolean` — True if billing is enabled for the user
- `hostedDomain?`: `string` — The user hosted domain
- `plan?`: `string` — The user's current plan
- `planOverdue?`: `boolean` — True if subscription payment is overdue
- `startedTrial?`: `boolean` — True if the user has started the trial period
- `totalTransactionsThisMonth?`: `number` — User-level total transactions this month
- `totalTransactionsThisYear?`: `number` — User-level total transactions this year

### Book

**Properties:**

- `accounts?`: `bkper.Account[]` — The book Accounts
- `agentId?`: `string` — The id of agent that created the resource
- `autoPost?`: `boolean` — Tells if the Book has auto post enabled
- `closingDate?`: `string` — The book closing date, in ISO format yyyy-MM-dd. Transactions on or before this date are closed for the period
- `collection?`: `bkper.Collection`
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `datePattern?`: `string` — The date pattern of the Book. Example: dd/MM/yyyy
- `decimalSeparator?`: `"DOT" | "COMMA"` — The decimal separator of the Book
- `fractionDigits?`: `number` — The number of fraction digits (decimal places) of the Book. E.g. 2 for ####.##, 4 for ####.####
- `groups?`: `bkper.Group[]` — The book account Groups
- `id?`: `string` — The unique id that identifies the Book in the system. Found at bookId url param
- `lastUpdateMs?`: `string` — The last update date of the Book, in milliseconds
- `lockDate?`: `string` — The book lock date, in ISO format yyyy-MM-dd. Transactions on or before this date are locked
- `logoUrl?`: `string` — The logo URL of the book owner's custom domain
- `name?`: `string` — The name of the Book
- `ownerName?`: `string` — The Book owner username
- `pageSize?`: `number` — The transactions pagination page size
- `period?`: `"MONTH" | "QUARTER" | "YEAR"` — The period slice for balances visualization
- `periodStartMonth?`: `"JANUARY" | "FEBRUARY" | "MARCH" | "APRIL" | "MAY" | "JUNE" | "JULY" | "AUGUST" | "SEPTEMBER" | "OCTOBER" | "NOVEMBER" | "DECEMBER"` — The start month when YEAR period set
- `permission?`: `"OWNER" | "EDITOR" | "POSTER" | "RECORDER" | "VIEWER" | "NONE"` — The Permission the current user has in the Book
- `properties?`: `{ [name: string]: string }` — The key/value custom properties of the Book
- `timeZone?`: `string` — The time zone of the Book, in IANA format. E.g. America/New_York, Europe/London
- `timeZoneOffset?`: `number` — The time zone offset of the Book, in minutes
- `totalTransactions?`: `number` — The total transactions posted
- `totalTransactionsCurrentMonth?`: `number` — The total transactions posted on current month
- `totalTransactionsCurrentYear?`: `number` — The total transactions posted on current year
- `updatedAt?`: `string` — The last update timestamp, in milliseconds
- `visibility?`: `"PUBLIC" | "PRIVATE"` — The Visibility of the Book

### BookList

**Properties:**

- `items?`: `bkper.Book[]` — List items

### BotResponse

**Properties:**

- `agentId?`: `string`
- `createdAt?`: `string`
- `message?`: `string`
- `type?`: `"INFO" | "WARNING" | "ERROR"`

### Collaborator

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `email?`: `string` — The email of the Collaborator
- `id?`: `string` — The unique id that identifies the Collaborator in the Book
- `permission?`: `"OWNER" | "EDITOR" | "POSTER" | "RECORDER" | "VIEWER" | "NONE"` — The permission the Collaborator has in the Book
- `updatedAt?`: `string` — The last update timestamp, in milliseconds

### CollaboratorPayloadCollection

**Properties:**

- `items?`: `bkper.Collaborator[]`

### Collection

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `books?`: `bkper.Book[]` — The Books contained in the Collection
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `id?`: `string` — The unique id of the Collection
- `name?`: `string` — The name of the Collection
- `ownerUsername?`: `string` — The username of the Collection owner
- `permission?`: `"OWNER" | "EDITOR" | "POSTER" | "RECORDER" | "VIEWER" | "NONE"` — The permission the current user has in the Collection. E.g. OWNER, EDITOR, NONE
- `updatedAt?`: `string` — The last update timestamp, in milliseconds

### CollectionList

**Properties:**

- `items?`: `bkper.Collection[]` — List items

### Connection

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `dateAddedMs?`: `string`
- `email?`: `string`
- `id?`: `string`
- `logo?`: `string`
- `name?`: `string`
- `properties?`: `{ [name: string]: string }`
- `type?`: `"APP" | "BANK"`
- `updatedAt?`: `string` — The last update timestamp, in milliseconds
- `userId?`: `string`
- `uuid?`: `string`

### ConnectionList

**Properties:**

- `items?`: `bkper.Connection[]` — List items

### Count

**Properties:**

- `day?`: `number`
- `fuzzyDate?`: `number`
- `month?`: `number`
- `total?`: `number`
- `year?`: `number`

### Counts

**Properties:**

- `posted?`: `bkper.Count[]`
- `trashed?`: `bkper.Count[]`

### Event

**Properties:**

- `agent?`: `bkper.Agent`
- `book?`: `bkper.Book`
- `bookId?`: `string` — The id of the Book associated to the Event
- `botResponses?`: `bkper.BotResponse[]` — The list of bot responses associated to the Event
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `createdOn?`: `string` — The creation date time on RFC3339 format
- `data?`: `bkper.EventData`
- `id?`: `string` — The unique id that identifies the Event
- `resource?`: `string` — The resource associated to the Event
- `type?`: `"FILE_CREATED" | "FILE_UPDATED" | "TRANSACTION_CREATED" | "TRANSACTION_UPDATED" | "TRANSACTION_DELETED" | "TRANSACTION_POSTED" | "TRANSACTION_CHECKED" | "TRANSACTION_UNCHECKED" | "TRANSACTION_RESTORED" | "ACCOUNT_CREATED" | "ACCOUNT_UPDATED" | "ACCOUNT_DELETED" | "QUERY_CREATED" | "QUERY_UPDATED" | "QUERY_DELETED" | "GROUP_CREATED" | "GROUP_UPDATED" | "GROUP_DELETED" | "COMMENT_CREATED" | "COMMENT_DELETED" | "COLLABORATOR_ADDED" | "COLLABORATOR_UPDATED" | "COLLABORATOR_REMOVED" | "INTEGRATION_CREATED" | "INTEGRATION_UPDATED" | "INTEGRATION_DELETED" | "BOOK_CREATED" | "BOOK_AUDITED" | "BOOK_UPDATED" | "BOOK_DELETED"` — The type of the Event
- `user?`: `bkper.User`

### EventData

**Properties:**

- `object?`: `unknown`
- `previousAttributes?`: `{ [name: string]: string }` — The object previous attributes when updated

### EventList

**Properties:**

- `cursor?`: `string` — The cursor, for pagination
- `items?`: `bkper.Event[]` — List items

### File

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `content?`: `string` — The file content Base64 encoded
- `contentType?`: `string` — The file content type
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `id?`: `string` — The unique id that identifies the file in the book
- `name?`: `string` — The file name
- `properties?`: `{ [name: string]: string }` — The key/value custom properties of the File
- `size?`: `number` — The file size in bytes
- `updatedAt?`: `string` — The last update timestamp, in milliseconds
- `url?`: `string` — The file serving url

### Group

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `credit?`: `boolean` — Whether the group has credit nature
- `hasAccounts?`: `boolean` — Whether the group has any accounts
- `hasGroups?`: `boolean` — Whether the group has any children groups
- `hidden?`: `boolean` — Whether the group is hidden on the transactions main menu
- `id?`: `string` — The unique id that identifies the Group in the Book
- `locked?`: `boolean` — Whether the group is locked by the Book owner
- `mixed?`: `boolean` — Whether the group has mixed types of accounts
- `name?`: `string` — The name of the Group
- `normalizedName?`: `string` — The name of the Group, lowercase, without spaces or special characters
- `parent?`: `bkper.Group`
- `permanent?`: `boolean` — Whether the group is permanent
- `properties?`: `{ [name: string]: string }` — The key/value custom properties of the Group
- `type?`: `"ASSET" | "LIABILITY" | "INCOMING" | "OUTGOING"` — The type of the accounts in the group. E.g. ASSET, LIABILITY, INCOMING, OUTGOING
- `updatedAt?`: `string` — The last update timestamp, in milliseconds

### GroupBalances

**Properties:**

- `accountBalances?`: `bkper.AccountBalances[]`
- `balances?`: `bkper.Balance[]`
- `credit?`: `boolean`
- `cumulativeBalance?`: `string`
- `cumulativeCredit?`: `string`
- `cumulativeDebit?`: `string`
- `groupBalances?`: `bkper.GroupBalances[]`
- `name?`: `string`
- `normalizedName?`: `string`
- `periodBalance?`: `string`
- `periodCredit?`: `string`
- `periodDebit?`: `string`
- `permanent?`: `boolean`
- `properties?`: `{ [name: string]: string }`

### GroupList

**Properties:**

- `items?`: `bkper.Group[]` — List items

### Integration

**Properties:**

- `addedBy?`: `string`
- `agentId?`: `string` — The id of agent that created the resource
- `bookId?`: `string`
- `connectionId?`: `string`
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `dateAddedMs?`: `string`
- `id?`: `string`
- `lastUpdateMs?`: `string`
- `logo?`: `string`
- `logoDark?`: `string`
- `name?`: `string`
- `normalizedName?`: `string`
- `properties?`: `{ [name: string]: string }`
- `updatedAt?`: `string` — The last update timestamp, in milliseconds
- `userId?`: `string`

### IntegrationList

**Properties:**

- `items?`: `bkper.Integration[]` — List items

### Query

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `id?`: `string` — The unique id that identifies the saved Query in the Book
- `query?`: `string` — The Query string to be executed
- `title?`: `string` — The title of the saved Query
- `updatedAt?`: `string` — The last update timestamp, in milliseconds

### QueryList

**Properties:**

- `items?`: `bkper.Query[]` — List items

### Template

**Properties:**

- `bookId?`: `string`
- `bookLink?`: `string`
- `category?`: `string`
- `description?`: `string`
- `imageUrl?`: `string`
- `name?`: `string`
- `sheetsLink?`: `string`
- `timesUsed?`: `number`

### TemplateList

**Properties:**

- `items?`: `bkper.Template[]` — List items

### Transaction

**Properties:**

- `agentId?`: `string` — The id of agent that created the resource
- `agentLogo?`: `string` — The logo of the agent that created the transaction
- `agentLogoDark?`: `string` — The logo in dark mode, of the agent that created the transaction
- `agentName?`: `string` — The name of the agent that created the transaction
- `amount?`: `string` — The amount on format ####.##
- `checked?`: `boolean` — Whether the transaction is checked
- `createdAt?`: `string` — The creation timestamp, in milliseconds
- `createdBy?`: `string` — The actor username that created the transaction
- `creditAccount?`: `bkper.Account`
- `date?`: `string` — The date on ISO format yyyy-MM-dd
- `dateFormatted?`: `string` — The date on format of the Book
- `dateValue?`: `number` — The date number representation on format YYYYMMDD
- `debitAccount?`: `bkper.Account`
- `description?`: `string` — The transaction description
- `draft?`: `boolean` — Whether the transaction is a draft
- `files?`: `bkper.File[]` — The files attached to the transaction
- `id?`: `string` — The unique id that identifies the transaction in the book
- `posted?`: `boolean` — Whether the transaction is already posted on accounts, otherwise is a draft
- `properties?`: `{ [name: string]: string }` — The key/value custom properties of the Transaction
- `remoteIds?`: `string[]` — The transaction remote ids, to avoid duplication
- `tags?`: `string[]` — The transaction #hashtags
- `trashed?`: `boolean` — Whether the transaction is trashed
- `updatedAt?`: `string` — The last update timestamp, in milliseconds
- `urls?`: `string[]` — The transaction urls

### TransactionList

**Properties:**

- `account?`: `string` — The account id when filtering by a single account. E.g. account='Bank'
- `cursor?`: `string` — The cursor, for pagination
- `items?`: `bkper.Transaction[]` — List items

### TransactionOperation

**Properties:**

- `accounts?`: `bkper.Account[]` — The affected accounts
- `transaction?`: `bkper.Transaction`

### Url

**Properties:**

- `url?`: `string`

### User

**Properties:**

- `avatarUrl?`: `string` — The user public avatar url
- `bankConnections?`: `boolean` — True if user already had any bank connection
- `billingAdminEmail?`: `string` — The billing admin email for this user's billing account
- `billingEnabled?`: `boolean` — True if billing is enabled for the user
- `daysLeftInTrial?`: `number` — How many days left in trial
- `email?`: `string` — The user email
- `free?`: `boolean` — True if user is in the free plan
- `fullName?`: `string` — The user full name
- `givenName?`: `string` — The user given name
- `hash?`: `string` — The user hash
- `hostedDomain?`: `string` — The user hosted domain
- `id?`: `string` — The user unique id
- `name?`: `string` — The user display name
- `plan?`: `string` — The user plan
- `planOverdue?`: `boolean` — True if subscription payment is overdue
- `startedTrial?`: `boolean` — True if user started trial
- `totalTransactionsThisMonth?`: `number` — User-level total transactions this month
- `totalTransactionsThisYear?`: `number` — User-level total transactions this year
- `username?`: `string` — The Bkper username of the user

