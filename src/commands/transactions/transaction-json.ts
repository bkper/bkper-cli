import type { Transaction } from 'bkper-js';

/**
 * Serializes a transaction for CLI output.
 *
 * Keeps the bkper-api-types shape (so output can be piped back into
 * `transaction create/update`) and all data fields, with two changes:
 * - `creditAccount.name` / `debitAccount.name` are added, so the from/to flow
 *   is readable without a separate account lookup.
 * - Inline agent logos (`agentLogo`, `agentLogoDark`) are dropped: they are
 *   image payloads, not information, and dominate output size.
 *
 * @param transaction - The transaction to serialize
 * @returns A new payload object; the transaction itself is not mutated
 */
export async function transactionToJson(transaction: Transaction): Promise<bkper.Transaction> {
    const json: bkper.Transaction = { ...transaction.json() };
    delete json.agentLogo;
    delete json.agentLogoDark;

    const [creditAccount, debitAccount] = await Promise.all([
        json.creditAccount ? transaction.getCreditAccount() : undefined,
        json.debitAccount ? transaction.getDebitAccount() : undefined,
    ]);

    if (json.creditAccount && creditAccount) {
        json.creditAccount = { ...json.creditAccount, name: creditAccount.getName() };
    }
    if (json.debitAccount && debitAccount) {
        json.debitAccount = { ...json.debitAccount, name: debitAccount.getName() };
    }

    return json;
}

/**
 * Serializes a list of transactions for CLI output.
 *
 * Runs sequentially so an account missing from the book cache is fetched once
 * and then served from cache, instead of one parallel request per transaction.
 */
export async function transactionsToJson(
    transactions: Transaction[]
): Promise<bkper.Transaction[]> {
    const result: bkper.Transaction[] = [];
    for (const transaction of transactions) {
        result.push(await transactionToJson(transaction));
    }
    return result;
}
