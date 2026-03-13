import { isLoggedIn, getOAuthToken } from '../../auth/local-auth-service.js';

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
    if (!isLoggedIn()) {
        console.error('Error: Not logged in. Run: bkper auth login');
        process.exit(1);
    }
    const accessToken = await getOAuthToken();
    if (process.stdout.isTTY) {
        console.log(accessToken);
    } else {
        process.stdout.write(accessToken);
    }
}
