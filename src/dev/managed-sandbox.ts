/**
 * Bkper's managed agent sandbox sets `BKPER_MANAGED_SANDBOX=1`. There the CLI has no login of its own:
 * the sandbox's egress adds the owner's credentials to Bkper API and AI requests, replacing any
 * Authorization header. Never inferred from a missing login.
 */
export function isManagedSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.BKPER_MANAGED_SANDBOX === '1';
}

/** The access token `bkper app dev` hands out in the managed sandbox; the sandbox's egress replaces it. */
export const MANAGED_SANDBOX_ACCESS_TOKEN = 'placeholder-replaced-outside-the-sandbox';

/** The user id `bkper app dev` hands out in the managed sandbox, where the CLI does not know the owner. */
export const MANAGED_SANDBOX_USER_ID = 'managed-sandbox';
