# Transaction Merge Operation - Complete Documentation

## Overview

The **TransactionMergeOperation** is a critical feature in Bkper's financial transaction management system that intelligently merges two duplicate or related transactions into a single consolidated transaction. This operation is commonly used when:

- Duplicate transactions are detected from different sources (e.g., bank import vs manual entry)
- Partial information needs to be combined from multiple transaction records
- Automated systems create transactions that need to be merged with user-created ones

## Source File Path

**Primary Implementation:**
```
/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/transaction/merge/TransactionMergeOperation.java
```

**Key Dependencies:**
- `/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/transaction/TransactionWrapper.java` - Transaction entity wrapper
- `/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/transaction/TransactionServiceImpl.java` - Service that invokes merge operation
- `/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/Amount.java` - Monetary amount handling
- `/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/book/BookWrapper.java` - Book context
- `/workspace/bkper-clients/packages/gwt/client/src/main/java/com/bkper/api/client/attachment/Attachment.java` - File attachments

**Where It's Used:**
- `TransactionServiceImpl.java:757` - Called by the merge service method
- `TransactionWrapperTest.java:57,64` - Unit tests demonstrating merge behavior

## Core Concept

The merge operation takes **two transactions** and combines them into:
1. **One edited transaction** (`edit`) - The primary transaction that gets updated with merged data
2. **One reverted transaction** (`revert`) - The secondary transaction that gets marked as trashed/reverted
3. **An optional record string** (`record`) - A human-readable audit trail when amounts differ

## Data Model

### Input Parameters (Constructor)

```typescript
interface TransactionMergeOperationInput {
  book: BookWrapper;           // Book context for formatting/rules
  transaction1: TransactionWrapper;  // First transaction to merge
  transaction2: TransactionWrapper;  // Second transaction to merge
}
```

### Output Properties

```typescript
interface TransactionMergeOperationOutput {
  edit: TransactionWrapper;    // The transaction to be updated (kept)
  revert: TransactionWrapper;  // The transaction to be deleted/reverted
  record: string | null;       // Audit record if amounts differ
}
```

### Transaction Data Structure

```typescript
interface TransactionWrapper {
  // Core Fields
  id: string;
  amount: Amount | null;             // Monetary amount (BigDecimal wrapper)
  description: string | null;        // Transaction description/memo
  dateValue: number | null;          // Date as YYYYMMDD integer
  dateFormatted: string | null;      // Formatted date string
  
  // Account References
  creditAccountId: number | null;    // Credit account ID
  debitAccountId: number | null;     // Debit account ID
  
  // Status
  status: TransactionStatus;         // DRAFT, UNCHECKED, CHECKED, etc.
  trashed: boolean;                  // Is marked for deletion
  checked: boolean;                  // Is reconciled/checked
  
  // Metadata
  createdAtMs: number;               // Creation timestamp (milliseconds)
  updatedAtMs: number | null;        // Last update timestamp
  
  // Attachments & Links
  attachments: Attachment[];         // File attachments
  urls: string[];                    // External URLs
  remoteIds: Set<string>;           // External system IDs (bank, etc.)
  
  // Custom Data
  properties: Map<string, string>;   // Key-value custom properties
  tags: Set<string>;                 // Hashtags extracted from description
}

interface Amount {
  value: BigDecimal;                 // Precise decimal value
  
  // Methods
  subtract(other: Amount): Amount;
  abs(): Amount;
  compareTo(other: Amount): number;
}

interface Attachment {
  artifactId: string;
  servingUrl: string;
  filename: string;
  fileSize: string;
  contentType: string;
  content: string;
  properties: Map<string, string>;
}
```

## Algorithm Logic

### Step 1: Determine Which Transaction to Keep (`edit`) vs Revert (`revert`)

**Priority Rules (in order):**

```typescript
function determineEditAndRevert(
  transaction1: TransactionWrapper,
  transaction2: TransactionWrapper
): { edit: TransactionWrapper; revert: TransactionWrapper } {
  
  // Rule 1: Prefer posted transactions over drafts
  if (transaction1.isDraft() && !transaction2.isDraft()) {
    return { edit: transaction2, revert: transaction1 };
  }
  if (!transaction1.isDraft() && transaction2.isDraft()) {
    return { edit: transaction1, revert: transaction2 };
  }
  
  // Rule 2: If both same status, prefer older transaction (lower createdAtMs)
  if (transaction1.createdAtMs < transaction2.createdAtMs) {
    return { edit: transaction2, revert: transaction1 };
  }
  
  // Rule 3: Default - keep transaction2
  return { edit: transaction1, revert: transaction2 };
}
```

**Logic Explanation:**
- **Posted transactions win over drafts** - Assumes posted transactions are more authoritative
- **Newer transaction wins** - The more recent transaction (higher `createdAtMs`) becomes the `edit` target
- This ensures the most complete/recent data is preserved

### Step 2: Merge Data Fields

After determining `edit` and `revert`, the algorithm merges data from `revert` into `edit`:

#### 2.1 Description Merging (Smart Text Merge)

```typescript
function mergeDescription(desc1: string | null, desc2: string | null): string {
  // Handle null cases
  if (!desc1) return desc2 || '';
  if (!desc2) return desc1;
  
  // Split desc2 into words (delimiters: space, hyphen, underscore)
  const words = desc2.split(/[ \-_]/);
  
  // Remove words from desc2 that already exist in desc1 (case-insensitive)
  const desc1Lower = desc1.toLowerCase();
  const uniqueWords = words.filter(word => 
    !desc1Lower.includes(word.toLowerCase())
  );
  
  // Concatenate desc1 + unique words from desc2
  return trim(desc1 + ' ' + uniqueWords.join(' '));
}

// Example:
// desc1 = "DAS #impostos Simples Nacional Mensal"
// desc2 = "INT DAS-SIMPLES NACIONA"
// Result = "DAS #impostos Simples Nacional Mensal INT"
```

**Key Points:**
- Avoids duplicate words (case-insensitive matching)
- Preserves all unique information from both descriptions
- Word delimiters: space, hyphen (`-`), underscore (`_`)

#### 2.2 Attachments Merging

```typescript
// Add all attachments from revert to edit
edit.attachments = [...edit.attachments, ...revert.attachments];
```

#### 2.3 Remote IDs Merging

```typescript
// Combine remote IDs (external system identifiers)
edit.remoteIds = new Set([...edit.remoteIds, ...revert.remoteIds]);
```

**Purpose:** Links transaction to multiple external sources (e.g., bank import ID, API sync ID)

#### 2.4 URLs Merging

```typescript
// Combine URL lists
edit.urls = [...edit.urls, ...revert.urls];
```

#### 2.5 Properties Merging

```typescript
// Merge custom key-value properties
// Note: revert properties OVERWRITE edit properties for same keys
edit.properties = {
  ...edit.properties,
  ...revert.properties  // revert wins for duplicate keys
};
```

#### 2.6 Credit Account Backfill

```typescript
// If edit lacks credit account, use revert's
if (!edit.creditAccountId && revert.creditAccountId) {
  edit.creditAccountId = revert.creditAccountId;
}
```

#### 2.7 Debit Account Backfill

```typescript
// If edit lacks debit account, use revert's
if (!edit.debitAccountId && revert.debitAccountId) {
  edit.debitAccountId = revert.debitAccountId;
}
```

#### 2.8 Amount Handling (Most Complex)

```typescript
function handleAmountMerge(
  edit: TransactionWrapper,
  revert: TransactionWrapper,
  book: BookWrapper
): string | null {
  
  // Case 1: Both have amounts but they differ
  if (edit.amount && revert.amount && edit.amount.compareTo(revert.amount) !== 0) {
    const revertDescription = revert.description || '';
    const diff = edit.amount.subtract(revert.amount);
    
    // Format the difference amount using book's number format
    let formattedAmount: string;
    try {
      formattedAmount = NumberFormatUtil.format(diff.abs(), book);
    } catch (error) {
      formattedAmount = diff.abs().toString();
    }
    
    // Create audit record: "date amount description"
    // Example: "25/01/2018 20.00 DAS #impostos Simples Nacional Mensal"
    return `${revert.dateFormatted} ${formattedAmount} ${revertDescription}`;
  }
  
  // Case 2: Edit has no amount, use revert's amount
  if (!edit.amount && revert.amount) {
    edit.amount = revert.amount;
  }
  
  // Case 3: Amounts are same or edit has amount - no record needed
  return null;
}
```

**Amount Merging Logic:**
1. **Different amounts** → Generate `record` string with difference details
2. **Edit missing amount** → Copy revert's amount to edit
3. **Same amounts or edit has amount** → Keep edit's amount, no record

**Record String Format:**
```
[revert.dateFormatted] [absolute_difference] [revert.description]
```

Example: `"25/01/2018 20.00 DAS #impostos Simples Nacional Mensal"`

## Service Integration

### How It's Called (TransactionServiceImpl)

```typescript
async function merge(
  book: BookWrapper,
  currentQuery: string,
  transaction1: TransactionWrapper,
  transaction2: TransactionWrapper
): Promise<void> {
  const bookId = book.id;
  
  // Perform merge operation
  const mergeOperation = new TransactionMergeOperation(book, transaction1, transaction2);
  
  // Revert the losing transaction (marks as trashed)
  await revert(bookId, currentQuery, mergeOperation.revert);
  
  // Update the winning transaction with merged data
  await edit(bookId, currentQuery, mergeOperation.edit);
  
  // If amounts differed, save audit record as new transaction
  if (mergeOperation.record) {
    await save(bookId, currentQuery, mergeOperation.record, null);
  }
}
```

**Three API Operations:**
1. **`revert()`** - Marks the `revert` transaction as trashed
2. **`edit()`** - Updates the `edit` transaction with merged data
3. **`save()`** - Creates audit record if amounts differed (optional)

## Test Case Examples

### Test 1: Different Amounts with Description Merge

```typescript
// Input
const transaction1 = {
  amount: Amount.of("100.00"),
  description: "DAS #impostos Simples Nacional Mensal",
  createdAtMs: 1,
  remoteIds: new Set(["someid"]),
  dateFormatted: "25/01/2018"
};

const transaction2 = {
  amount: Amount.of("80.00"),
  description: "INT DAS-SIMPLES NACIONA",
  createdAtMs: 2,
  dateFormatted: "26/01/2018"
};

// Merge operation
const mergeOp = new TransactionMergeOperation(book, transaction1, transaction2);

// Expected Output
assert(mergeOp.record === "25/01/2018 20.00 DAS #impostos Simples Nacional Mensal");
assert(mergeOp.edit.description === "INT DAS-SIMPLES NACIONA #impostos Nacional Mensal");
assert(mergeOp.edit.amount.equals(Amount.of("80.00")));
assert(mergeOp.edit.remoteIds.has("someid"));
assert(mergeOp.revert === transaction1);
```

**Key Observations:**
- `transaction2` becomes `edit` (newer, higher `createdAtMs`)
- Description merged intelligently: "INT" added, duplicate words removed
- Amount difference (20.00) recorded in `record` string
- Remote ID carried over from `revert` to `edit`

### Test 2: Cascading Merges

```typescript
// Second merge: transaction2 + transaction3
const transaction3 = {
  description: "transaction 3",
  createdAtMs: 3,
  dateFormatted: "27/01/2018"
};

const mergeOp2 = new TransactionMergeOperation(book, transaction2, transaction3);

// Expected Output
assert(mergeOp2.edit.description === "transaction 3 INT DAS SIMPLES NACIONA #impostos Nacional Mensal");
assert(mergeOp2.edit.remoteIds.has("someid"));  // Carried through from first merge
assert(mergeOp2.edit.amount.equals(Amount.of("80.00")));
```

**Key Observation:** Data accumulates across multiple merges (remote IDs, amounts, descriptions)

## TypeScript Implementation Considerations

### 1. Amount Precision

```typescript
// Use a decimal library like decimal.js or big.js
import { Decimal } from 'decimal.js';

class Amount {
  constructor(private value: Decimal) {}
  
  static of(value: string | null): Amount | null {
    return value ? new Amount(new Decimal(value)) : null;
  }
  
  subtract(other: Amount): Amount {
    return new Amount(this.value.minus(other.value));
  }
  
  abs(): Amount {
    return new Amount(this.value.abs());
  }
  
  compareTo(other: Amount): number {
    return this.value.cmp(other.value);
  }
  
  toString(): string {
    return this.value.toString();
  }
}
```

### 2. Text Splitting (Word Splitter)

```typescript
// Java: Splitter.on(CharMatcher.anyOf(" -_"))
// TypeScript equivalent:
function splitWords(text: string): string[] {
  return text.split(/[ \-_]+/).filter(word => word.length > 0);
}
```

### 3. Set Operations for Remote IDs

```typescript
// Merging sets
const mergedRemoteIds = new Set([
  ...edit.remoteIds,
  ...revert.remoteIds
]);
```

### 4. Map Merging for Properties

```typescript
// Properties merge (revert overwrites edit)
const mergedProperties = {
  ...edit.properties,
  ...revert.properties
};
```

### 5. Null Safety

```typescript
// Ensure null checks throughout
if (edit.amount !== null && revert.amount !== null) {
  // Both amounts exist
}
```

### 6. Number Formatting

```typescript
// Book-specific number formatting
function formatAmount(amount: Amount, book: BookWrapper): string {
  const decimalSeparator = book.decimalSeparator; // '.' or ','
  const precision = book.precision; // decimal places
  
  return amount.value.toFixed(precision)
    .replace('.', decimalSeparator);
}
```

## Complete TypeScript Migration Template

```typescript
import { Decimal } from 'decimal.js';

interface TransactionWrapper {
  id?: string;
  amount: Amount | null;
  description: string | null;
  dateValue: number | null;
  dateFormatted: string | null;
  creditAccountId: number | null;
  debitAccountId: number | null;
  status: TransactionStatus;
  trashed: boolean;
  checked: boolean;
  createdAtMs: number;
  updatedAtMs: number | null;
  attachments: Attachment[];
  urls: string[];
  remoteIds: Set<string>;
  properties: Record<string, string>;
  tags: Set<string>;
  
  isDraft(): boolean;
}

class Amount {
  constructor(private value: Decimal) {}
  
  static of(value: string | null): Amount | null {
    return value ? new Amount(new Decimal(value)) : null;
  }
  
  subtract(other: Amount): Amount {
    return new Amount(this.value.minus(other.value));
  }
  
  abs(): Amount {
    return new Amount(this.value.abs());
  }
  
  compareTo(other: Amount): number {
    return this.value.cmp(other.value);
  }
  
  toString(): string {
    return this.value.toString();
  }
}

class TransactionMergeOperation {
  public edit: TransactionWrapper;
  public revert: TransactionWrapper;
  public record: string | null = null;
  
  private static readonly WORD_SPLITTER = /[ \-_]+/;
  
  constructor(
    private book: BookWrapper,
    transaction1: TransactionWrapper,
    transaction2: TransactionWrapper
  ) {
    // Determine which transaction to edit vs revert
    if (transaction1.isDraft() && !transaction2.isDraft()) {
      this.revert = transaction1;
      this.edit = transaction2;
    } else if (!transaction1.isDraft() && transaction2.isDraft()) {
      this.revert = transaction2;
      this.edit = transaction1;
    } else if (transaction1.createdAtMs < transaction2.createdAtMs) {
      this.revert = transaction1;
      this.edit = transaction2;
    } else {
      this.revert = transaction2;
      this.edit = transaction1;
    }
    
    this.merge();
  }
  
  private merge(): void {
    // Merge description
    this.edit.description = this.mergeDescription(
      this.edit.description,
      this.revert.description
    );
    
    // Merge attachments
    this.edit.attachments = [
      ...this.edit.attachments,
      ...this.revert.attachments
    ];
    
    // Merge remote IDs
    this.edit.remoteIds = new Set([
      ...this.edit.remoteIds,
      ...this.revert.remoteIds
    ]);
    
    // Merge URLs
    this.edit.urls = [
      ...this.edit.urls,
      ...this.revert.urls
    ];
    
    // Merge properties (revert overwrites)
    this.edit.properties = {
      ...this.edit.properties,
      ...this.revert.properties
    };
    
    // Backfill credit account
    if (!this.edit.creditAccountId && this.revert.creditAccountId) {
      this.edit.creditAccountId = this.revert.creditAccountId;
    }
    
    // Backfill debit account
    if (!this.edit.debitAccountId && this.revert.debitAccountId) {
      this.edit.debitAccountId = this.revert.debitAccountId;
    }
    
    // Handle amount merging
    if (this.edit.amount && this.revert.amount) {
      if (this.edit.amount.compareTo(this.revert.amount) !== 0) {
        const revertDescription = this.revert.description || '';
        const diff = this.edit.amount.subtract(this.revert.amount);
        
        let formattedAmount: string;
        try {
          formattedAmount = this.formatAmount(diff.abs());
        } catch (error) {
          formattedAmount = diff.abs().toString();
        }
        
        this.record = `${this.revert.dateFormatted} ${formattedAmount} ${revertDescription}`;
      }
    } else if (!this.edit.amount && this.revert.amount) {
      this.edit.amount = this.revert.amount;
    }
  }
  
  private mergeDescription(desc1: string | null, desc2: string | null): string {
    if (!desc1) return desc2 || '';
    if (!desc2) return desc1;
    
    const desc1Lower = desc1.toLowerCase();
    const words = desc2.split(TransactionMergeOperation.WORD_SPLITTER)
      .filter(word => word.length > 0);
    
    const uniqueWords = words.filter(word => 
      !desc1Lower.includes(word.toLowerCase())
    );
    
    return this.trim(desc1 + ' ' + uniqueWords.join(' '));
  }
  
  private formatAmount(amount: Amount): string {
    // Implement book-specific number formatting
    // Use book.decimalSeparator, book.precision, etc.
    return amount.toString(); // Simplified
  }
  
  private trim(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
}

// Usage in service
async function mergeTransactions(
  book: BookWrapper,
  currentQuery: string,
  transaction1: TransactionWrapper,
  transaction2: TransactionWrapper
): Promise<void> {
  const mergeOperation = new TransactionMergeOperation(book, transaction1, transaction2);
  
  await revertTransaction(book.id, currentQuery, mergeOperation.revert);
  await editTransaction(book.id, currentQuery, mergeOperation.edit);
  
  if (mergeOperation.record) {
    await saveTransaction(book.id, currentQuery, mergeOperation.record, null);
  }
}
```

## Summary

The **TransactionMergeOperation** is a sophisticated data consolidation algorithm that:

1. **Intelligently chooses** which transaction to keep (posted > draft, newer > older)
2. **Merges descriptions** without duplication (smart word-level deduplication)
3. **Consolidates metadata** (attachments, URLs, remote IDs, properties)
4. **Backfills missing data** (accounts, amounts)
5. **Creates audit trail** when amounts differ
6. **Preserves data integrity** while eliminating duplicates

This pattern is essential for financial systems where duplicate transactions from multiple sources (manual entry, bank imports, API syncs) must be reconciled into a single source of truth.
