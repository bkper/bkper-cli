import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import { CodeChallengeMethod, Credentials, OAuth2Client } from 'google-auth-library';
import { generateAuthPage } from './auth-page.js';

/**
 * OAuth configuration for Bkper CLI.
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security.
 *
 * Note: Google requires client_secret even for desktop apps with PKCE.
 * For desktop/CLI apps, Google considers the client_secret "not confidential"
 * as it can be extracted from distributed applications. The real security
 * comes from PKCE, user consent, and secure token storage.
 *
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 */
const OAUTH_CONFIG = {
    clientId: '927657669669-ig60i5ic9i9esdc8q59plardm11fuubc.apps.googleusercontent.com',
    clientSecret: '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',
    redirectUri: 'http://localhost:3000/oauth2callback',
};

let storedCredentials: Credentials | undefined;

const oldCredentialsPath = `${os.homedir()}/.bkper-credentials.json`;
const configDir = `${os.homedir()}/.config/bkper`;
const storedCredentialsPath = `${configDir}/.bkper-credentials.json`;

// Migrate from old location if exists
if (!fs.existsSync(storedCredentialsPath) && fs.existsSync(oldCredentialsPath)) {
    try {
        // Ensure config directory exists
        fs.mkdirSync(configDir, { recursive: true });
        // Move credentials to new location
        const oldCredentials = fs.readFileSync(oldCredentialsPath, 'utf8');
        fs.writeFileSync(storedCredentialsPath, oldCredentials, 'utf8');
        fs.rmSync(oldCredentialsPath);
    } catch {
        // Migration failed - will fall back to old behavior
    }
}

try {
    const credentialsJson = fs.readFileSync(storedCredentialsPath, 'utf8');
    storedCredentials = JSON.parse(credentialsJson) as Credentials;
} catch {
    // Credentials will be undefined if not found - no need to log during module loading
}

/**
 * Initiates the OAuth login flow. If already logged in, notifies the user
 * and refreshes the token.
 */
export async function login() {
    if (storedCredentials) {
        console.log('Bkper already logged in.');
    }
    await getOAuthToken();
}

/**
 * Logs out by revoking remote access when possible and always removing local credentials.
 */
export async function logout(): Promise<void> {
    const tokenToRevoke = storedCredentials?.refresh_token ?? storedCredentials?.access_token;

    try {
        if (tokenToRevoke) {
            const localAuth = createOAuthClient();
            await localAuth.revokeToken(tokenToRevoke);
            clearCredentials();
            console.log('Bkper logged out. Remote access revoked and local credentials cleared.');
            return;
        }
    } catch (err) {
        clearCredentials();
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
            `Bkper logged out locally, but remote token revocation failed: ${message}`
        );
        return;
    }

    clearCredentials();
    console.log('Bkper logged out. Local credentials cleared.');
}

/**
 * Checks whether the user has stored OAuth credentials.
 *
 * @returns true if credentials are present, false otherwise
 */
export function isLoggedIn() {
    return storedCredentials != null;
}

/**
 * Returns the currently stored OAuth credentials, if any.
 */
export function getStoredCredentials(): Credentials | undefined {
    return storedCredentials;
}

/**
 * Generates PKCE code verifier and code challenge.
 * PKCE (Proof Key for Code Exchange) eliminates the need for client_secret
 * in public clients like CLI applications.
 */
function generatePKCECodes(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(96).toString('base64url').slice(0, 128);
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    return { codeVerifier, codeChallenge };
}

function createOAuthClient(): OAuth2Client {
    return new OAuth2Client({
        clientId: OAUTH_CONFIG.clientId,
        clientSecret: OAUTH_CONFIG.clientSecret,
        redirectUri: OAUTH_CONFIG.redirectUri,
    });
}

function mergeCredentials(
    base: Credentials | undefined,
    updates: Credentials
): Credentials {
    const merged: Credentials = { ...(base ?? {}) };
    const mergedRecord = merged as Record<string, unknown>;

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            mergedRecord[key] = value;
        }
    }

    return merged;
}

function registerCredentialPersistence(localAuth: OAuth2Client) {
    localAuth.on('tokens', (tokens: Credentials) => {
        storeCredentials(mergeCredentials(storedCredentials, tokens));
    });
}

/**
 * Performs local OAuth2 authentication by starting a local server,
 * opening the user's browser, and waiting for the authorization code.
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security without client_secret.
 */
async function authenticateLocal(): Promise<OAuth2Client> {
    const pkceCodes = generatePKCECodes();
    const oAuth2Client = createOAuthClient();

    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.email'],
        prompt: 'consent',
        code_challenge: pkceCodes.codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
    });

    const open = (await import('open')).default;

    return new Promise((resolve, reject) => {
        const redirectUrl = new URL(OAUTH_CONFIG.redirectUri);
        const port = parseInt(redirectUrl.port) || 3000;

        const server = http.createServer(async (req, res) => {
            try {
                if (req.url && req.url.startsWith('/oauth2callback')) {
                    const searchParams = new URL(req.url, `http://localhost:${port}`).searchParams;
                    const code = searchParams.get('code');

                    if (code) {
                        const { tokens } = await oAuth2Client.getToken({
                            code,
                            codeVerifier: pkceCodes.codeVerifier,
                        });
                        oAuth2Client.setCredentials(tokens);

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(
                            generateAuthPage({
                                type: 'success',
                                title: 'Authentication Successful',
                                message: 'You have been successfully authenticated with Bkper CLI.',
                            })
                        );

                        server.closeAllConnections();
                        server.close();

                        resolve(oAuth2Client);
                    } else {
                        const error = searchParams.get('error');
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(
                            generateAuthPage({
                                type: 'error',
                                title: 'Authentication Failed',
                                message: error || 'No authorization code received.',
                            })
                        );
                        server.closeAllConnections();
                        server.close();
                        reject(new Error(error || 'No authorization code received'));
                    }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(
                    generateAuthPage({
                        type: 'error',
                        title: 'Authentication Error',
                        message: errorMessage,
                    })
                );
                server.closeAllConnections();
                server.close();
                reject(err);
            }
        });

        server.listen(port, () => {
            console.log(`\nOpen this URL to authenticate:\n${authorizeUrl}\n`);
            open(authorizeUrl, { wait: false }).catch(() => {
                // Browser couldn't open - URL already displayed above
            });
        });

        server.on('error', err => {
            reject(new Error(`Failed to start local server: ${err.message}`));
        });
    });
}

/**
 * Returns a valid OAuth token from stored credentials without starting an interactive login flow.
 *
 * If stored credentials are missing, expired, or revoked, returns undefined and clears any stale
 * local credentials.
 */
export async function getStoredOAuthToken(): Promise<string | undefined> {
    if (!storedCredentials) {
        return undefined;
    }

    const localAuth = createOAuthClient();
    localAuth.setCredentials(storedCredentials);
    registerCredentialPersistence(localAuth);

    try {
        const token = await localAuth.getAccessToken();
        if (!token.token) {
            clearCredentials();
            return undefined;
        }
        return token.token;
    } catch {
        clearCredentials();
        return undefined;
    }
}

/**
 * Returns a valid OAuth token, launching the browser login flow if needed.
 */
export async function getOAuthToken(): Promise<string> {
    const hadStoredCredentials = storedCredentials != null;
    const storedToken = await getStoredOAuthToken();
    if (storedToken) {
        return storedToken;
    }

    if (hadStoredCredentials) {
        console.log('Session expired. Re-authenticating...');
    }

    const localAuth = await authenticateLocal();
    registerCredentialPersistence(localAuth);
    storeCredentials(mergeCredentials(storedCredentials, localAuth.credentials));

    const token = await localAuth.getAccessToken();
    return token.token || '';
}

function storeCredentials(credentials: Credentials) {
    storedCredentials = credentials;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(storedCredentialsPath, JSON.stringify(credentials, null, 4), 'utf8');
}

/**
 * Clears stored credentials from memory and disk.
 * Used when credentials become invalid (e.g., revoked, expired, or from a different OAuth client).
 */
function clearCredentials() {
    storedCredentials = undefined;
    if (fs.existsSync(storedCredentialsPath)) {
        fs.rmSync(storedCredentialsPath);
    }
    if (fs.existsSync(oldCredentialsPath)) {
        fs.rmSync(oldCredentialsPath);
    }
}
