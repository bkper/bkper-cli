import { getBkperInstance } from '../../bkper-factory.js';
import { Account, AccountType } from 'bkper-js';
import { parsePropertyFlag } from '../../utils/properties.js';
import type { StdinValue } from '../../input/index.js';

const CHUNK_SIZE = 100;

/**
 * Resolves a StdinValue that may be a string[] or comma-separated string into a string array.
 */
function resolveArray(value: StdinValue): string[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }
    return [];
}

/**
 * Creates multiple accounts from stdin items using the batch API.
 * Outputs NDJSON (one JSON object per line) as each chunk completes.
 *
 * Stdin field names follow the Bkper API format:
 *   name, type, groups
 *
 * @param bookId - Target book ID
 * @param items - Parsed stdin items (field-value maps)
 * @param propertyOverrides - CLI --property flags that override stdin fields
 */
export async function batchCreateAccounts(
    bookId: string,
    items: Record<string, StdinValue>[],
    propertyOverrides?: string[]
): Promise<void> {
    const bkper = getBkperInstance();
    const book = await bkper.getBook(bookId);

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const accounts: Account[] = [];

        for (const item of chunk) {
            const account = new Account(book);
            if (item.name) account.setName(String(item.name));
            if (item.type) {
                const accountType = AccountType[String(item.type) as keyof typeof AccountType];
                if (accountType !== undefined) account.setType(accountType);
            }

            // Set properties from stdin fields (excluding known fields)
            const knownFields = new Set(['name', 'type', 'groups']);
            for (const [key, value] of Object.entries(item)) {
                if (!knownFields.has(key) && value !== '') {
                    account.setProperty(key, String(value));
                }
            }

            // CLI --property flags override stdin
            if (propertyOverrides) {
                for (const raw of propertyOverrides) {
                    const [key, value] = parsePropertyFlag(raw);
                    if (value === '') {
                        account.deleteProperty(key);
                    } else {
                        account.setProperty(key, value);
                    }
                }
            }

            if (item.groups) {
                for (const groupName of resolveArray(item.groups)) {
                    const group = await book.getGroup(groupName);
                    if (group) {
                        account.addGroup(group);
                    }
                }
            }

            accounts.push(account);
        }

        const results = await book.batchCreateAccounts(accounts);
        for (const result of results) {
            console.log(JSON.stringify(result.json()));
        }
    }
}
