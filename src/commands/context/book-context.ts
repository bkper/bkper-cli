import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {GitRunner} from '../apps/git/run-git.js';
import {BOOK_ID, ContextError, type ContextScope, type PlatformContextApi} from './platform-context.js';
import {syncContextClone, type PullOutcome} from './user-context.js';

/**
 * A Book's agent context clone (docs/plans/agent-context.md in bkper-clients, section 9): its AGENTS.md and
 * `.agents/skills`, shared with everyone who can view the Book; editors publish with a push. The person runs an agent in
 * the folder, which reads them natively. The Book ID lives only in the clone's Git config (`bkper.bookId`, and its
 * credential helper), never in the shared files.
 */
const BOOK_ID_KEY = 'bkper.bookId';

export const bookContextScope = (bookId: string): ContextScope => `books/${bookId}`;

/** A folder-safe version of a Book's name: lowercase ASCII letters, digits and dashes; the Book ID when nothing is left. */
export function bookFolderName(name: string, bookId: string): string {
    const safe = name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 80)
        .replace(/^-+|-+$/g, '');
    return safe || bookId;
}

/** The Book whose context clone `cwd` is (or is inside), from its Git config; undefined for any other folder. */
export function bookIdOfClone(cwd: string): string | undefined {
    try {
        const result = spawnSync('git', ['config', '--get', BOOK_ID_KEY], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const bookId = result.status === 0 ? result.stdout.trim() : '';
        return BOOK_ID.test(bookId) ? bookId : undefined;
    } catch {
        return undefined;
    }
}

export interface CloneBookContextOptions {
    bookId: string;
    /** The folder to clone into; by default a folder-safe version of the Book's name, in `cwd`. */
    folder?: string;
    cwd?: string;
    api?: PlatformContextApi;
    runner?: GitRunner;
    /** The Book's name, from Core as the signed-in person: the default folder. */
    bookName: (bookId: string) => Promise<string>;
}

/**
 * Clone a Book's agent context into a new folder: stops if the folder exists, and creates nothing when the person cannot
 * view the Book. Ready to push even before anything was published (only editors' pushes are accepted).
 */
export async function cloneBookContext(options: CloneBookContextOptions): Promise<{dir: string; outcome: PullOutcome}> {
    const {bookId} = options;
    if (!BOOK_ID.test(bookId)) {
        throw new ContextError(`'${bookId}' is not a Book ID.`);
    }
    const folder = options.folder ?? bookFolderName(await options.bookName(bookId), bookId);
    const dir = path.resolve(options.cwd ?? process.cwd(), folder);
    if (fs.existsSync(dir)) {
        throw new ContextError(
            `${dir} already exists. Choose another folder: bkper book clone ${bookId} <folder>`
        );
    }
    const outcome = await syncContextClone(bookContextScope(bookId), dir, {
        api: options.api,
        runner: options.runner,
        configure: async (runner, clone) => {
            await runner(['config', BOOK_ID_KEY, bookId], {cwd: clone});
        },
    });
    return {dir, outcome};
}
