import { AUTHENTICATION_REQUIRED_MESSAGE } from '../../auth/auth-errors.js';
import { getStoredOAuthToken } from '../../auth/local-auth-service.js';

/**
 * Prints the current OAuth access token to stdout.
 *
 * When piped or redirected, outputs only the raw token string
 * for shell substitution: TOKEN=$(bkper auth token)
 *
 * When run interactively (TTY), adds a trailing newline so the
 * token doesn't collide with the shell prompt.
 */
export async function token(): Promise<void> {
    const accessToken = await getStoredOAuthToken();
    if (!accessToken) {
        console.error(`Error: ${AUTHENTICATION_REQUIRED_MESSAGE}`);
        process.exit(1);
    }
    if (process.stdout.isTTY) {
        console.log(accessToken);
    } else {
        process.stdout.write(accessToken);
    }
}
