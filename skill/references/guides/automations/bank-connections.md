# Bank Connections

Bkper Bank Connections let you connect directly to your financial institution — banks, credit card operators, credit unions, and more — and post transactions in your Book as they are made available by the institution.

Bkper integrates with institutions in **North America and Europe** via [Plaid](https://plaid.com/) and in **Brazil** via [Pluggy](https://pluggy.ai/en).

## How Bank Connections work

A Bank Connection consists of three parts:

**User Connection** — the authentication and authorization step handled by the connection provider. For European connections, Plaid handles this process, and Bkper does not receive or store your bank credentials. You can disconnect at any time.

**Book Integration** — the configuration that defines the Book and Account where the bank connection posts transactions.

**Post Transactions** — once the integration is active, transactions from the institution are posted in your Book.

This separation is important for professional workflows. For example, a client can create the User Connection — keeping credentials private — while their bookkeeper or CPA integrates that connection with a specific Account in a shared Book.

## Create a Bank Connection

To create a new Bank Connection, open your Book and navigate to the **Settings menu** (⚙️). Select **Automations**, then click **Banks** in the left panel. Choose your country (highlighted in green) and select your bank from the list. Complete the authentication and authorization flow — this process varies by country and institution.

> **Note**
> A video tutorial is available: <a href="https://youtu.be/wIVIZ_R9kj8?si=sTS52syFD_DvPhSQ&t=66" data-analytics-event="cta_click" data-analytics-id="docs_bank_connections_create_video" data-analytics-label="Create a Bank Connection">Create a Bank Connection</a>.
Once authenticated, your User Connection is established. The next step is to integrate the connection with a Book and choose the Account where transactions should be posted.

## Integrate with a Book

After creating a User Connection, integrate it with a Book so that transactions from your financial institution are posted to the right Account.

Open your Book and go to **Settings** (⚙️) → **Automations**. Click **User Connections** in the left panel, then select the connection you want to integrate.

Click **Link Account** next to the specific account at your financial institution.

Select or create the **Account** in your Book where transactions should be posted, choose how much historical data to post, and press **Save**.

> **Note**
> A video tutorial is available: <a href="https://youtu.be/wIVIZ_R9kj8?si=kngwSYXq1RJrU2Xo&t=159" data-analytics-event="cta_click" data-analytics-id="docs_bank_connections_integrate_video" data-analytics-label="Integrate a Bank Connection with your Book">Integrate a Bank Connection with your Book</a>.
> **Caution**
> It can take up to 48 hours for transactions to be posted in your Book after creating an integration. The larger the historical period you select, the longer posting may take. Some financial institutions do not support historical data — in that case, use the <a href="/docs/guides/using-bkper/data-import-export/import-data" data-analytics-event="cta_click" data-analytics-id="docs_bank_connections_manual_import" data-analytics-label="Manual data import">manual data import workflow</a>.
## Reconnect

If a Bank Connection has been disconnected — whether intentionally or due to a session expiration — you can reconnect it from the <a href="/docs/guides/automations/automations-portal" data-analytics-event="cta_click" data-analytics-id="docs_bank_connections_automations_portal" data-analytics-label="Automations portal">Automations portal</a>.

Open your Book and go to **Settings** (⚙️) → **Automations**. Click **User Connections**, select the disconnected bank, and click the **Reconnect** button.

> **Tip**
> To prevent duplicate transactions, always use the **Reconnect** button on the original connection rather than creating a new one.
## Remove an integration

Removing an integration stops transactions from a specific financial institution account from being posted in your Book. The User Connection itself remains active, so you can re-integrate it later or use it with a different Book.

Open your Book and go to **Settings** (⚙️) → **Automations**. Click **Book Integrations**, select the bank or credit card you want to remove, and click **Remove**.

> **Note**
> Removing an integration does not delete any transactions that have already been posted in your Book. It only stops new transactions from being posted.
## Disconnect

When you no longer need a connection to a financial institution, you can disconnect it entirely from the [Automations portal](https://bkper.com/docs/guides/automations/automations-portal.md).

Open your Book and go to **Settings** (⚙️) → **Automations**. Click **User Connections** in the left panel and select the Bank Connection you want to remove.

Click **Disconnect**.

Confirm by clicking **Yes**.

> **Caution**
> All Book Integrations linked to this User Connection will be removed as well. If you only want to stop posting transactions in a specific Book, [remove the integration](#remove-an-integration) instead.
## Troubleshooting

If you are experiencing issues connecting or reconnecting your bank to Bkper, try the suggestions below.

### Transactions are not being posted

**Wait a little.** After creating your first Book integration, it typically takes some time for transactions to be posted.

**Resave the historical period.** Go to **Settings** (⚙️) → **Automations** → **Book Integrations**, select the integration, choose a new historical period, and click **Save Configuration**.

### Could not connect to your institution

**Invalid credentials** — double-check the username and password you entered. Extra spaces, incorrect capitalization, and punctuation errors are the most common causes.

**Temporary technical problems** — the financial institution may be experiencing downtime. Try again later.

### Transactions stopped posting

After a period of working smoothly, your Bank Connection may stop posting transactions. This can happen due to technical issues, periodic disconnections, or security measures enforced by your bank.

To re-establish the connection:

1. **Remove the integration** — go to **Settings** (⚙️) → **Automations** → **Book Integrations**, select the bank account that stopped posting transactions, and click **Remove**.
2. **Disconnect the User Connection** — still in Automations, go to **User Connections**, select the connection, and click **Disconnect**.
3. **Create a new connection** — follow the steps in [Create a Bank Connection](#create-a-bank-connection).
4. **Integrate with your Book** — follow the steps in [Integrate with a Book](#integrate-with-a-book).

This process refreshes the integration and ensures that the connection is correctly established.

> **Tip**
> If the issue persists after trying these steps, contact Bkper support with the name of your financial institution so the team can investigate. You can also check directly with your bank whether they have any known issues with third-party connections.
