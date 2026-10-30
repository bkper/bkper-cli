import {
    AGENT_CHECK_INTERVAL_MS,
    formatUpdateNotice,
    getUpdateNotice,
    isUpdateCheckDisabled,
    maybeStartUpdateCheck,
    readUpdateState,
    type StartUpdateCheckOptions,
    type UpdateNotice,
} from '../upgrade/index.js';
import {isLoggedIn} from '../auth/local-auth-service.js';
import {pullBookContext, type BookPullOutcome} from '../commands/context/book-context.js';
import {pullUserContext, type PullOutcome} from '../commands/context/user-context.js';

type NotificationType = 'info' | 'warning' | 'error';

export interface StartupMaintenanceCallbacks {
    notify: (message: string, type?: NotificationType) => void;
}

export interface StartupMaintenanceDependencies {
    readNotice: () => UpdateNotice | undefined;
    startUpdateCheck: () => boolean;
    /** Bring the user's agent context clone up to date; undefined when there is nothing to pull with. */
    pullContext?: () => Promise<PullOutcome | undefined>;
    /** With `bkper agent -b <bookId>`, the same for that Book's clone. */
    pullBookContext?: () => Promise<BookPullOutcome | undefined>;
}

const UNPUSHED_CONTEXT_NOTICE =
    'Your agent context in ~/.bkper/context/user has changes not pushed, so newer published ones were not pulled.';
const UNPUSHED_BOOK_CONTEXT_NOTICE =
    "Your clone of this Book's agent context in ~/.bkper/context/books has changes not pushed, so newer published ones were not pulled.";

/**
 * Unlike plain commands (once a day), interactive sessions check on every
 * start, so new releases are picked up by the next session.
 */
export function startAgentUpdateCheck(options: StartUpdateCheckOptions = {}): boolean {
    return maybeStartUpdateCheck({...options, intervalMs: AGENT_CHECK_INTERVAL_MS});
}

/** The real dependencies; with a Book, its context is pulled too. */
export function startupMaintenanceDependencies(bookId?: string): StartupMaintenanceDependencies {
    return {
        readNotice: () => getUpdateNotice(readUpdateState()),
        startUpdateCheck: () => startAgentUpdateCheck(),
        pullContext: async () => (isLoggedIn() ? pullUserContext() : undefined),
        ...(bookId ? {pullBookContext: async () => (isLoggedIn() ? pullBookContext(bookId) : undefined)} : {}),
    };
}

/**
 * Pulls the user's agent context in the background, never waited on: newer pushes apply at the next start or `/reload`.
 * Only a clone with unpushed changes is worth telling about.
 */
function startContextPull(
    callbacks: StartupMaintenanceCallbacks,
    pull: (() => Promise<BookPullOutcome | undefined>) | undefined,
    notice: string
): void {
    if (!pull) {
        return;
    }
    try {
        void pull().then(
            outcome => {
                if (outcome === 'unpushed') {
                    callbacks.notify(notice, 'info');
                }
            },
            () => undefined
        );
    } catch {
        // Silent failure — never break the TUI
    }
}

/**
 * Starts the background pulls of the agent context (the user's, and the Book's with `--book`), reports the outcome of the last background update and starts
 * the daily check. The install itself runs in the detached update worker. Never waits on the network.
 */
export async function runStartupMaintenance(
    callbacks: StartupMaintenanceCallbacks,
    dependencies: StartupMaintenanceDependencies = startupMaintenanceDependencies()
): Promise<void> {
    startContextPull(callbacks, dependencies.pullContext, UNPUSHED_CONTEXT_NOTICE);
    startContextPull(callbacks, dependencies.pullBookContext, UNPUSHED_BOOK_CONTEXT_NOTICE);
    if (isUpdateCheckDisabled()) {
        return;
    }

    try {
        const notice = dependencies.readNotice();
        if (notice) {
            callbacks.notify(
                formatUpdateNotice(notice),
                notice.kind === 'installed' ? 'info' : 'warning'
            );
        }
        dependencies.startUpdateCheck();
    } catch {
        // Silent failure — never break the TUI
    }
}
