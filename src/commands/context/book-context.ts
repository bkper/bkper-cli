import os from 'node:os';
import path from 'node:path';
import {BOOK_ID, ContextForbiddenError, type ContextScope} from './platform-context.js';
import {getContextRoot, syncContextClone, type PullOptions, type PullOutcome} from './user-context.js';

/**
 * A Book's agent context clone (docs/plans/agent-context.md in bkper-clients, section 9): its AGENTS.md and
 * `.agents/skills`, shared with everyone who can view the Book; editors publish with a push. Kept beside the user's, in
 * `~/.bkper/books/<bookId>`: the folder names the Book, so nothing else records which Book a clone is.
 */
export const bookContextScope = (bookId: string): ContextScope => `books/${bookId}`;

export function getBookContextDir(bookId: string, home: string = os.homedir()): string {
    return path.join(getContextRoot(home), 'books', bookId);
}

/** A pull's outcome, or `forbidden`: the person cannot view the Book (nothing is created). */
export type BookPullOutcome = PullOutcome | 'forbidden';

/**
 * Bring a Book's context clone up to date with what is published, fast-forward only: creates it if missing (ready to push
 * even before anything was published; only editors' pushes are accepted), and leaves a clone with unpushed changes as it
 * is. Never throws.
 */
export async function pullBookContext(
    bookId: string,
    options: Omit<PullOptions, 'dir'> & {home?: string} = {}
): Promise<BookPullOutcome> {
    if (!BOOK_ID.test(bookId)) return 'failed';
    try {
        return await syncContextClone(bookContextScope(bookId), getBookContextDir(bookId, options.home), options);
    } catch (error) {
        return error instanceof ContextForbiddenError ? 'forbidden' : 'failed';
    }
}
