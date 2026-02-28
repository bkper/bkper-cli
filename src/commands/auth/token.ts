import { isLoggedIn, getOAuthToken } from '../../auth/local-auth-service.js';

/**
 * Prints the current OAuth access token to stdout.
 *
 * Designed for shell substitution: TOKEN=$(bkper auth token)
 * Outputs only the raw token string with no extra formatting.
 */
export async function token(): Promise<void> {
    if (!isLoggedIn()) {
        console.error('Error: Not logged in. Run: bkper auth login');
        process.exit(1);
    }
    const accessToken = await getOAuthToken();
    process.stdout.write(accessToken);
}
