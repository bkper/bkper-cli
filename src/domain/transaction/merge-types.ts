/**
 * Domain types for transaction merge operations
 *
 * These types represent the core business domain for merging transactions,
 * independent of any specific API or protocol (MCP, REST, etc.)
 */

/**
 * Merged transaction data that extends the base bkper.Transaction type
 * with compatibility fields for legacy systems and test fixtures
 */
export interface MergedTransactionData extends bkper.Transaction {
    /**
     * Compatibility field: alias for 'files' used in test fixtures
     */
    attachments?: bkper.File[];
    /**
     * Compatibility field: ID-only version of creditAccount for legacy systems
     */
    creditAccountId?: string;
    /**
     * Compatibility field: ID-only version of debitAccount for legacy systems
     */
    debitAccountId?: string;
}
