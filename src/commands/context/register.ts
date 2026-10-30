import type {Command} from 'commander';
import {withAction} from '../action.js';
import {getBookContextDir, pullBookContext, type BookPullOutcome} from './book-context.js';
import {runContextCredentialHelper} from './git-credential.js';
import {BOOK_ID, ContextError} from './platform-context.js';
import {getUserContextDir, pullUserContext, type PullOutcome} from './user-context.js';

const PULL_MESSAGES: Record<PullOutcome, string> = {
    synced: 'Up to date with what you published.',
    unpublished: 'Nothing published yet. Commit and push from here to publish to all your agents.',
    unpushed: 'Not updated: this clone has changes not pushed. Push or discard them, then pull again.',
    failed: 'Could not update your agent context. Check your login (bkper auth login) and connection.',
};

const BOOK_PULL_MESSAGES: Record<BookPullOutcome, string> = {
    synced: "Up to date with what the Book's editors published.",
    unpublished:
        "Nothing published for this Book yet. Its editors publish with a commit and push from here, to everyone who can view it.",
    unpushed: 'Not updated: this clone has changes not pushed. Push or discard them, then pull again.',
    failed: "Could not update this Book's agent context. Check your login (bkper auth login) and connection.",
    forbidden: "You cannot view this Book, so its agent context was not pulled. Ask the Book's owner to share it with you.",
};

/** `bkper context`: the agent context clones (yours, and a Book's), shared with all your agents. */
export function registerContextCommands(program: Command): void {
    const context = program
        .command('context')
        .description('Your agent context: AGENTS.md and skills shared with all your agents');

    context
        .command('pull')
        .description(
            "Clone or update ~/.bkper/context/user (fast-forward only); with --book, also the Book's in ~/.bkper/context/books/<bookId>"
        )
        .option('-b, --book <bookId>', "Also pull this Book's agent context")
        .action((options: {book?: string}) =>
            withAction(
                'pulling agent context',
                async () => {
                    const bookId = options.book;
                    if (bookId !== undefined && !BOOK_ID.test(bookId)) {
                        throw new ContextError(`'${bookId}' is not a Book ID.`);
                    }
                    const [outcome, bookOutcome] = await Promise.all([
                        pullUserContext(),
                        bookId === undefined ? undefined : pullBookContext(bookId),
                    ]);
                    console.log(`${getUserContextDir()}: ${PULL_MESSAGES[outcome]}`);
                    if (bookId !== undefined && bookOutcome) {
                        console.log(`${getBookContextDir(bookId)}: ${BOOK_PULL_MESSAGES[bookOutcome]}`);
                    }
                    if (outcome === 'failed' || bookOutcome === 'failed' || bookOutcome === 'forbidden') {
                        process.exit(1);
                    }
                },
                {skipSetup: true}
            )()
        );

    context
        .command('git-credential <scope> [operation]')
        .description('Internal noninteractive credential helper for agent context clones')
        .action((scope: string, operation: string | undefined) =>
            withAction(
                'running git credential helper',
                async () => {
                    // Git appends get|store|erase to the configured helper command.
                    const exitCode = await runContextCredentialHelper({scope, operation: operation ?? 'get'});
                    if (exitCode !== 0) process.exit(exitCode);
                },
                {skipSetup: true}
            )()
        );
}
