import { BkperError, type Book } from 'bkper-js';
import { throwIfErrors } from '../../utils/validation.js';

const SIDES = [
    { key: 'creditAccount', label: 'Credit account (from)' },
    { key: 'debitAccount', label: 'Debit account (to)' },
] as const;

function nameOnlyReference(item: bkper.Transaction, key: 'creditAccount' | 'debitAccount') {
    const reference = item[key];
    return reference && !reference.id && reference.name?.trim() ? reference.name : undefined;
}

/** The Account's id, or undefined when the Book has no Account with that name. */
async function findAccountId(book: Book, name: string): Promise<string | undefined> {
    try {
        return (await book.getAccount(name))?.getId();
    } catch (err) {
        if (err instanceof BkperError && err.code === 404) return undefined;
        throw err;
    }
}

/**
 * Gives each Account referenced only by name its id.
 *
 * The batch transaction API reads Account ids only and silently drops name-only
 * references. Each distinct name is looked up once, through the Book's Account
 * cache, so the chart of Accounts is never loaded; references with an id are
 * left as they are. Throws, naming every missing Account, before anything is sent.
 *
 * @param book - The Book the transactions belong to
 * @param items - Stdin transaction payloads
 * @returns The payloads with an id on every Account reference given by name
 */
export async function resolveAccountNames(
    book: Book,
    items: bkper.Transaction[]
): Promise<bkper.Transaction[]> {
    const names = new Set<string>();
    for (const item of items) {
        for (const { key } of SIDES) {
            const name = nameOnlyReference(item, key);
            if (name) names.add(name);
        }
    }

    const ids = new Map<string, string>();
    for (const name of names) {
        const id = await findAccountId(book, name);
        if (id) ids.set(name, id);
    }

    const errors: string[] = [];
    const resolved = items.map((item, index) => {
        const copy = { ...item };
        for (const { key, label } of SIDES) {
            const name = nameOnlyReference(item, key);
            if (!name) continue;
            const id = ids.get(name);
            if (id) {
                copy[key] = { ...item[key], id };
            } else {
                errors.push(`item[${index}]: ${label} not found: ${name}`);
            }
        }
        return copy;
    });

    throwIfErrors(errors);
    return resolved;
}
