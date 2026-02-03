import fs from 'fs';
import http from 'http';
import { Credentials, OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import os from 'os';
import crypto from 'crypto';

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

let storedCredentials: Credentials;

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
        // Credentials migrated successfully
    } catch (err) {
        // Migration failed - will fall back to old behavior
    }
}

try {
    const credentialsJson = fs.readFileSync(storedCredentialsPath, 'utf8');
    storedCredentials = JSON.parse(credentialsJson);
} catch (err) {
    // Credentials will be null if not found - no need to log during module loading
}

export async function login() {
    if (storedCredentials) {
        console.log('Bkper already logged in.');
    }
    await getOAuthToken();
}

export function logout() {
    if (fs.existsSync(storedCredentialsPath)) {
        fs.rmSync(storedCredentialsPath);
    }
    console.log('Bkper logged out.');
}

export function isLoggedIn() {
    return storedCredentials != null;
}

/**
 * Generates PKCE code verifier and code challenge
 * PKCE (Proof Key for Code Exchange) eliminates the need for client_secret
 * in public clients like CLI applications.
 * @returns Object containing codeVerifier and codeChallenge
 */
function generatePKCECodes(): { codeVerifier: string; codeChallenge: string } {
    // Generate code_verifier: 128 bytes of random data, base64url encoded
    const codeVerifier = crypto.randomBytes(96).toString('base64url').slice(0, 128);

    // Generate code_challenge: SHA256 hash of verifier, base64url encoded
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    return { codeVerifier, codeChallenge };
}

/**
 * Performs local OAuth2 authentication by starting a local server,
 * opening the user's browser, and waiting for the authorization code.
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security without client_secret.
 */
async function authenticateLocal(): Promise<OAuth2Client> {
    // PKCE: Generate code verifier and challenge for secure authentication
    // This eliminates the need for client_secret in public clients (CLI apps)
    const pkceCodes = generatePKCECodes();

    const oAuth2Client = new OAuth2Client({
        clientId: OAUTH_CONFIG.clientId,
        clientSecret: OAUTH_CONFIG.clientSecret,
        redirectUri: OAUTH_CONFIG.redirectUri,
    });

    // Generate the authorization URL with PKCE code challenge
    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.email'],
        prompt: 'consent',
        code_challenge: pkceCodes.codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
    });

    // Dynamically import 'open' to open the browser
    const open = (await import('open')).default;

    return new Promise((resolve, reject) => {
        // Extract port from redirect URI
        const redirectUrl = new URL(OAUTH_CONFIG.redirectUri);
        const port = parseInt(redirectUrl.port) || 3000;

        const server = http.createServer(async (req, res) => {
            try {
                if (req.url && req.url.startsWith('/oauth2callback')) {
                    const searchParams = new URL(req.url, `http://localhost:${port}`).searchParams;
                    const code = searchParams.get('code');

                    if (code) {
                        // Exchange the authorization code for tokens using PKCE
                        // Do this BEFORE sending response so we can show error if it fails
                        const { tokens } = await oAuth2Client.getToken({
                            code: code,
                            codeVerifier: pkceCodes.codeVerifier,
                        });
                        oAuth2Client.setCredentials(tokens);

                        // Only send success response after token exchange succeeds
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(
                            '<html><body><h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p></body></html>'
                        );

                        // Close the server and all connections
                        server.closeAllConnections();
                        server.close();

                        resolve(oAuth2Client);
                    } else {
                        const error = searchParams.get('error');
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(
                            `<html><body><h1>Authentication failed</h1><p>${
                                error || 'No authorization code received'
                            }</p></body></html>`
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
                    `<html><body><h1>Authentication error</h1><p>${errorMessage}</p></body></html>`
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
 * @returns A promise that resolves to a valid OAuth token.
 */
export async function getOAuthToken(): Promise<string> {
    let localAuth: OAuth2Client;

    if (storedCredentials) {
        localAuth = new OAuth2Client({
            clientId: OAUTH_CONFIG.clientId,
            clientSecret: OAUTH_CONFIG.clientSecret,
            redirectUri: OAUTH_CONFIG.redirectUri,
        });
        localAuth.setCredentials(storedCredentials);
    } else {
        localAuth = await authenticateLocal();
        storeCredentials(localAuth.credentials);
    }

    localAuth.on('tokens', (tokens: Credentials) => {
        if (tokens.refresh_token) {
            // store the refresh_token
            storeCredentials(tokens);
        }
    });

    const token = await localAuth.getAccessToken();

    return token.token || '';
}

function storeCredentials(credentials: Credentials) {
    storedCredentials = credentials;
    // Ensure config directory exists before writing
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(storedCredentialsPath, JSON.stringify(credentials, null, 4), 'utf8');
}
