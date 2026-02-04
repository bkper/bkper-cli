import type { Connect } from 'vite';
import { isLoggedIn, getOAuthToken } from '../auth/local-auth-service.js';

/**
 * Response format matching production /auth/refresh endpoint.
 */
interface AuthRefreshResponse {
    userId: string;
    accessToken: string;
}

/**
 * Error response format.
 */
interface AuthErrorResponse {
    error: string;
}

/**
 * Decodes a JWT token and extracts the payload.
 * Does NOT verify the signature - only extracts the payload.
 *
 * @param token - JWT token string
 * @returns Decoded payload object or null if invalid
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = parts[1];
        // JWT uses base64url encoding
        const decoded = Buffer.from(payload, 'base64url').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/**
 * Extracts user ID (email) from Google OAuth credentials.
 * The id_token is a JWT containing the user's email in the 'email' claim.
 *
 * @param accessToken - OAuth access token (not used for extraction, but triggers refresh)
 * @returns User ID (email) or 'unknown' if extraction fails
 */
async function extractUserId(): Promise<string> {
    // Read stored credentials to get id_token
    // The id_token contains user info as JWT claims
    try {
        const fs = await import('fs');
        const os = await import('os');
        const credentialsPath = `${os.homedir()}/.config/bkper/.bkper-credentials.json`;
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

        if (credentials.id_token) {
            const payload = decodeJwtPayload(credentials.id_token);
            if (payload && typeof payload.email === 'string') {
                return payload.email;
            }
        }
    } catch {
        // Fall through to unknown
    }

    return 'unknown';
}

/**
 * Creates Vite middleware that handles /auth/refresh requests.
 *
 * This middleware intercepts POST /auth/refresh requests and returns
 * an access token from the CLI's stored credentials, allowing web
 * clients to authenticate during local development without needing
 * to set up session cookies or connect to production auth servers.
 *
 * Response format matches production:
 * - 200: { userId: string, accessToken: string }
 * - 401: { error: string } - when not logged in
 * - 500: { error: string } - on unexpected errors
 *
 * @returns Vite/Connect middleware function
 */
export function createAuthMiddleware(): Connect.NextHandleFunction {
    return async (req, res, next) => {
        // Only handle POST /auth/refresh
        if (req.url !== '/auth/refresh' || req.method !== 'POST') {
            next();
            return;
        }

        res.setHeader('Content-Type', 'application/json');

        // Check if user is logged in to CLI
        if (!isLoggedIn()) {
            res.statusCode = 401;
            const errorResponse: AuthErrorResponse = {
                error: 'Not logged in. Run: bkper login',
            };
            res.end(JSON.stringify(errorResponse));
            return;
        }

        try {
            // Get fresh access token (auto-refreshes if expired)
            const accessToken = await getOAuthToken();
            const userId = await extractUserId();

            const response: AuthRefreshResponse = {
                userId,
                accessToken,
            };
            res.statusCode = 200;
            res.end(JSON.stringify(response));
        } catch (err) {
            res.statusCode = 500;
            const errorResponse: AuthErrorResponse = {
                error: err instanceof Error ? err.message : 'Failed to get access token',
            };
            res.end(JSON.stringify(errorResponse));
        }
    };
}
