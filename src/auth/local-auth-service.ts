import fs from "fs";
import http from "http";
import { Credentials, OAuth2Client } from "google-auth-library";
import os from "os";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keys = require(`${__dirname}/keys.json`);

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
        const oldCredentials = fs.readFileSync(oldCredentialsPath, "utf8");
        fs.writeFileSync(storedCredentialsPath, oldCredentials, "utf8");
        fs.rmSync(oldCredentialsPath);
        // Credentials migrated successfully
    } catch (err) {
        // Migration failed - will fall back to old behavior
    }
}

try {
    let credentialsJson = fs.readFileSync(storedCredentialsPath, "utf8");
    storedCredentials = JSON.parse(credentialsJson);
} catch (err) {
    // Credentials will be null if not found - no need to log during module loading
}

export async function login() {
    if (storedCredentials) {
        console.log("Bkper already logged in.");
    }
    await getOAuthToken();
}

export function logout() {
    if (fs.existsSync(storedCredentialsPath)) {
        fs.rmSync(storedCredentialsPath);
    }
    console.log("Bkper logged out.");
}

export function isLoggedIn() {
    return storedCredentials != null;
}

/**
 * Performs local OAuth2 authentication by starting a local server,
 * opening the user's browser, and waiting for the authorization code.
 */
async function authenticateLocal(): Promise<OAuth2Client> {
    const oAuth2Client = new OAuth2Client({
        clientId: keys.installed.client_id,
        clientSecret: keys.installed.client_secret,
        redirectUri: keys.installed.redirect_uris[0],
    });

    // Generate the authorization URL
    const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/userinfo.email"],
        prompt: "consent",
    });

    // Dynamically import 'open' to open the browser
    const open = (await import("open")).default;

    return new Promise((resolve, reject) => {
        // Extract port from redirect URI
        const redirectUrl = new URL(keys.installed.redirect_uris[0]);
        const port = parseInt(redirectUrl.port) || 3000;

        const server = http.createServer(async (req, res) => {
            try {
                if (req.url && req.url.startsWith("/oauth2callback")) {
                    const searchParams = new URL(req.url, `http://localhost:${port}`).searchParams;
                    const code = searchParams.get("code");

                    if (code) {
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(
                            "<html><body><h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p></body></html>"
                        );

                        // Exchange the authorization code for tokens
                        const { tokens } = await oAuth2Client.getToken(code);
                        oAuth2Client.setCredentials(tokens);

                        // Close the server and all connections
                        server.closeAllConnections();
                        server.close();

                        resolve(oAuth2Client);
                    } else {
                        const error = searchParams.get("error");
                        res.writeHead(400, { "Content-Type": "text/html" });
                        res.end(
                            `<html><body><h1>Authentication failed</h1><p>${
                                error || "No authorization code received"
                            }</p></body></html>`
                        );
                        server.closeAllConnections();
                        server.close();
                        reject(new Error(error || "No authorization code received"));
                    }
                }
            } catch (err) {
                res.writeHead(500, { "Content-Type": "text/html" });
                res.end("<html><body><h1>Authentication error</h1></body></html>");
                server.closeAllConnections();
                server.close();
                reject(err);
            }
        });

        server.listen(port, () => {
            console.log(`Opening browser for authentication...`);
            open(authorizeUrl, { wait: false }).catch(() => {
                console.log(`Please open the following URL in your browser:\n${authorizeUrl}`);
            });
        });

        server.on("error", (err) => {
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
            clientId: keys.installed.client_id,
            clientSecret: keys.installed.client_secret,
            redirectUri: keys.installed.redirect_uris[0],
        });
        localAuth.setCredentials(storedCredentials);
    } else {
        localAuth = await authenticateLocal();
        storeCredentials(localAuth.credentials);
    }

    localAuth.on("tokens", (tokens: Credentials) => {
        if (tokens.refresh_token) {
            // store the refresh_token
            storeCredentials(tokens);
        }
    });

    let token = await localAuth.getAccessToken();

    return token.token || "";
}

function storeCredentials(credentials: Credentials) {
    storedCredentials = credentials;
    // Ensure config directory exists before writing
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(storedCredentialsPath, JSON.stringify(credentials, null, 4), "utf8");
}
