import os from 'node:os';
import path from 'node:path';
import {ContextForbiddenError, type ContextScope} from './platform-context.js';
import {getContextRoot, syncContextClone, type PullOptions, type PullOutcome} from './user-context.js';

/**
 * The person's company's agent context clone (docs/plans/agent-context.md in bkper-clients, section 9): the AGENTS.md and
 * `.agents/skills` of their verified domain, read by everyone in it; only the domain's admin publishes, with a push. Platform
 * takes the domain from Bkper for the signed-in person, so nothing here names it. Kept beside the user's, in
 * `~/.bkper/context/domain`.
 */
export const DOMAIN_CONTEXT_SCOPE: ContextScope = 'domain';

export function getDomainContextDir(home: string = os.homedir()): string {
    return path.join(getContextRoot(home), DOMAIN_CONTEXT_SCOPE);
}

/** A pull's outcome, or `none`: the person has no domain (Platform refuses its read; nothing is created). */
export type DomainPullOutcome = PullOutcome | 'none';

/**
 * Bring the domain's context clone up to date with what is published, fast-forward only: creates it if missing (ready to push
 * even before anything was published; only the admin's pushes are accepted), and leaves a clone with unpushed changes as it
 * is. Never throws.
 */
export async function pullDomainContext(options: Omit<PullOptions, 'dir'> & {home?: string} = {}): Promise<DomainPullOutcome> {
    try {
        return await syncContextClone(DOMAIN_CONTEXT_SCOPE, getDomainContextDir(options.home), options);
    } catch (error) {
        return error instanceof ContextForbiddenError ? 'none' : 'failed';
    }
}
