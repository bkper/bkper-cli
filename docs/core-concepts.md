# Core Concepts

Bkper tracks resources — money, inventory, or anything countable — as movements between places. Every financial event is recorded as an amount moving **from** one Account **to** another. This from-to model replaces the traditional language of debits and credits with something intuitive: resources leave one place and arrive at another.

The system enforces a **zero-sum invariant** — the total of all records always equals zero. Nothing is created or destroyed, only transferred. This makes Bkper a double-entry bookkeeping system where every transaction automatically produces balanced entries.

For those familiar with traditional accounting, "from" corresponds to credit and "to" corresponds to debit — but the explicit flow eliminates the need to memorize these rules.

## Accounts

**Accounts** are the places where resources reside or flow through. An Account can represent a bank, a category, a customer, a project, or anything else that holds or transfers value. You define what each Account represents and structure them at whatever level of detail suits your needs.

An Account registers all incoming and outgoing amounts through transactions. The sum of these movements produces the account's **balance** — the net result of everything that has flowed in and out.

## Account Types

Bkper organizes Accounts into four types that determine how an Account behaves and where it appears in your financial structure:

- **Asset** (blue) — **permanent**. Real resources you own: bank accounts, cash, receivables. Balances carry forward continuously, showing your position at any point in time.
- **Liability** (yellow) — **permanent**. Obligations you owe: credit cards, loans, supplier debts. Balances also carry forward continuously.
- **Incoming** (green) — **non-permanent**. Revenue sources: salary, sales, interest. Balances track activity within a period and reset to zero for the next one.
- **Outgoing** (red) — **non-permanent**. Expenses and costs: rent, supplies, payroll. Balances also track activity within a period.

## Transactions

A **Transaction** is the atomic unit of financial activity. It captures:

- **Date** — when it happened
- **Amount** — how much moved
- **From Account** — where the resource came from
- **To Account** — where it went
- **Description** — what happened

The from-to model makes every event explicit and traceable.

A transaction is nothing more than moving a resource from one place to another. When you pay a taxi for a ride, the amount that goes from your wallet to the driver represents a transaction.

If any essential element is missing, the transaction is saved as an incomplete draft.

## Transaction States

Transactions move through a lifecycle with four states:

- **Draft** — incomplete or unposted. Does not affect balances.
- **Unchecked** — posted and updates balances, but remains editable.
- **Checked** — reviewed and locked for integrity.
- **Trashed** — removed from balances, but recoverable.

This structure puts a **human in the loop** — you review and confirm before records become permanent.

## Groups

**Groups** organize Accounts into hierarchies for reporting and analysis. They don't change the underlying data — they provide structure for understanding it. Groups consolidate account balances, so you can see totals for categories like "Expenses" or "Assets" at a glance.

Groups support hierarchies (groups of groups) and multiple perspectives — an Account can belong to different groups in different hierarchies.

Groups inherit the nature of the accounts they contain:

- **Asset-only group** — behaves as Asset (blue)
- **Liability-only group** — behaves as Liability (yellow)
- **Mixed Asset + Liability** — shows Equity (gray, net balance)
- **Incoming-only group** — behaves as Income (green)
- **Outgoing-only group** — behaves as Expense (red)
- **Mixed Incoming + Outgoing** — shows Net Result (gray)

## Books

A **Book** is a self-contained ledger — the complete scope of an entity, whether an individual, a project, or a business. Every Account, Transaction, and Group lives within a Book, and every Book balances to zero. Books can track any countable resource using the same from-to model.

The sum of all credits and debits recorded in a Book always tallies to zero — nothing is created or destroyed, only transferred. For more complex entities, multiple Books can be organized into a Collection.

## Example Flows

These examples show the same movement model in concrete situations. Some match the diagrams on this page. Others add common accrual flows that are easy to confuse.

These examples use Bkper's transaction shorthand `From >> To`, meaning the amount leaves the Account on the left and arrives at the Account on the right.

| Situation | Transaction |
| --- | --- |
| Salary received | `Salary >> Bank Account` |
| Investment funded | `Bank Account >> Investments` |
| Dividends received | `Dividends >> Bank Account` |
| Loan received | `Loan >> Bank Account` |
| Rent paid | `Bank Account >> Rent` |
| Transportation bought on credit card | `Credit Card >> Transportation` |

**Buy on a credit card now, pay it later**

| Step | Transaction |
| --- | --- |
| Purchase | `Credit Card >> Outgoing` |
| Payment | `Bank Account >> Credit Card` |

**Sell now and receive cash later**

| Step | Transaction |
| --- | --- |
| Sale on credit | `Incoming >> Accounts Receivable` |
| Interest added while unpaid | `Incoming >> Accounts Receivable` |
| Collection | `Accounts Receivable >> Bank Account` |

**Receive a supplier bill now and pay it later**

| Step | Transaction |
| --- | --- |
| Bill received | `Accounts Payable >> Outgoing` |
| Interest added while unpaid | `Accounts Payable >> Outgoing` |
| Payment | `Bank Account >> Accounts Payable` |

**Receive a loan now and repay principal later**

| Step | Transaction |
| --- | --- |
| Loan proceeds | `Loan >> Bank Account` |
| Principal repayment | `Bank Account >> Loan` |

In each case, the first movement records the position that was created — a receivable or a liability. The later movement settles that position. This keeps Incoming and Outgoing focused on activity, while Asset and Liability Accounts hold positions until they are cleared.

If a receivable or payable grows before settlement, record another movement to that same Account, then settle the total later.

## Balances

**Balances** are always calculated from Transactions, never stored independently. The total balance across all Accounts in a Book is always zero. Account type determines how balances behave over time:

- **Permanent Accounts** (Asset & Liability) — balance **to a date**, showing cumulative position at a point in time.
- **Non-permanent Accounts** (Incoming & Outgoing) — balance **within a period**, showing activity during a timeframe.

Bkper maintains a continuous ledger with no concept of closing periods — the same ledger serves all time-based queries automatically.

## Custom Properties

**Custom Properties** are key-value pairs attachable to any entity — Books, Accounts, Groups, Transactions, Collections, and Files. They add context, metadata, and meaning beyond core financial data.

By attaching properties like `invoice: inv123456` or `exc_code: BRL`, entities become rich with information that can drive automation and reporting — without changing the core model.

## Hashtags

**Hashtags** are lightweight labels on Transactions that enable multi-dimensional tracking. They complement the Account structure by adding dynamic categorization — a single transaction might carry `#team_marketing #project_alpha #q1_campaign`, enabling filtering and analysis from any perspective.

Unlike Account structures, Hashtags can be added or removed as needs evolve, making them ideal for cost allocation, project tracking, and ad-hoc analysis.

## Collections

**Collections** group related Books for organization and consolidated views. Each Book remains self-contained and balanced — Collections simply provide navigation and structure across multiple Books. You might track resources in multiple currencies, or organize branch offices in one collection.

Collections can also serve as references for automations (Bots or Apps) that work on all Books in the collection.

## Events

Every action in a Book — posting a transaction, editing an account, adding a comment — generates an **Event**. Events record _who_ (a user) or _what_ (a bot, an automation) performed the action and _when_, forming a complete audit trail essential for collaboration and trust.

Events are also the foundation of Bkper's automation model. Bots and Agents listen for specific event types and react automatically — for example, calculating taxes when a transaction is posted or converting currencies when one is checked.
