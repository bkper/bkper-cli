# Bank Connections

Use this guide when a user wants to connect a bank, credit card, or other financial institution to a Book.

Bank connections are set up by the user in the Bkper UI, not through the CLI. Your job is to send them straight to the connection flow for their country.

## Route

1. Know the Book. If the Book ID is unknown, ask which Book or find it with `bkper book list`.
2. Ask which country the bank is in.
3. Check the live coverage. Do not rely on memory or a fixed list:

    ```bash
    curl -s https://bkper.app/automations/api/banks/coverage
    ```

    Each entry has the country `code` and `name`.

4. If the country is supported, share the link with the Book ID and the lowercase country code:

    ```text
    https://bkper.app/automations/{bookId}/banks/{countryCode}
    ```

    The link opens the connection flow for that country, where the user picks their bank and signs in.

5. If the country is not supported, say so and suggest importing bank statements instead.

## After connecting

Once connected, the user links each bank account to an Account in the Book from User Connections: `https://bkper.app/automations/{bookId}/connections`. Transactions can take up to 48 hours to appear.
