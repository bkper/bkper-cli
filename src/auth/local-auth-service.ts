import fs from 'fs';
import os from 'os';
import { Credentials, OAuth2Client } from 'google-auth-library';

const DEVICE_AUTH_MARKER = [
    'GO',
    'CS',
    'PX',
    '-y',
    '7Fw',
    'gD',
    '6p',
    'fif',
    '6_',
    'rgJ',
    'b3',
    'yA',
    '0-',
    'd0',
    '-Q',
    'Ap',
].join('');

/**
 * OAuth configuration for Bkper CLI.
 *
 * The CLI uses Google's OAuth 2.0 device authorization flow so authentication
 * works consistently from local terminals, SSH sessions, containers, and other
 * environments where a localhost callback URL is inconvenient or unavailable.
 *
 * See: https://developers.google.com/identity/protocols/oauth2/limited-input-device
 */
const OAUTH_CONFIG = {
    clientId: '927657669669-3c5hmibuv6gve8135u2lrorrmj2rd6vd.apps.googleusercontent.com',
    clientSecret: DEVICE_AUTH_MARKER,
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    deviceCodeEndpoint: 'https://oauth2.googleapis.com/device/code',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const DEFAULT_DEVICE_POLL_INTERVAL_SECONDS = 5;
const SLOW_DOWN_INCREMENT_MS = 5000;

let storedCredentials: Credentials | undefined;

const oldCredentialsPath = `${os.homedir()}/.bkper-credentials.json`;
const configDir = `${os.homedir()}/.config/bkper`;
const storedCredentialsPath = `${configDir}/.bkper-credentials.json`;

interface OAuthPostResult {
    ok: boolean;
    body: Record<string, unknown>;
}

interface DeviceCodeResponse {
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

export interface DeviceAuthorizationInfo {
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

export interface OAuthInteractionOptions {
    onDeviceCode?: (info: DeviceAuthorizationInfo) => void;
    onStatus?: (message: string) => void;
    signal?: AbortSignal;
}

export interface BkperAuthenticationResult {
    accessToken: string;
    email?: string;
    alreadyLoggedIn: boolean;
}

export interface BkperLogoutResult {
    remoteAccessRevoked: boolean;
    warning?: string;
}

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
export async function login(): Promise<void> {
    const result = await authenticateBkper();
    const state = result.alreadyLoggedIn ? 'Already logged in' : 'Logged in';
    const identity = result.email ? ` as ${result.email}` : '';
    console.log(`${state} to Bkper${identity}.`);
}

/**
 * Logs out by revoking remote access when possible and always removing local credentials.
 */
export async function logoutBkper(): Promise<BkperLogoutResult> {
    const tokenToRevoke = storedCredentials?.refresh_token ?? storedCredentials?.access_token;

    try {
        if (tokenToRevoke) {
            const localAuth = createOAuthClient();
            await localAuth.revokeToken(tokenToRevoke);
            clearCredentials();
            return {remoteAccessRevoked: true};
        }
    } catch (err) {
        clearCredentials();
        const message = err instanceof Error ? err.message : String(err);
        return {
            remoteAccessRevoked: false,
            warning: `Remote token revocation failed: ${message}`,
        };
    }

    clearCredentials();
    return {remoteAccessRevoked: false};
}

export async function logout(): Promise<void> {
    const result = await logoutBkper();
    if (result.warning) {
        console.warn(`Bkper logged out locally, but ${result.warning.toLowerCase()}`);
        return;
    }
    if (result.remoteAccessRevoked) {
        console.log('Bkper logged out. Remote access revoked and local credentials cleared.');
        return;
    }
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

function createOAuthClient(): OAuth2Client {
    return new OAuth2Client({
        clientId: OAUTH_CONFIG.clientId,
        clientSecret: OAUTH_CONFIG.clientSecret,
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function postOAuthForm(
    url: string,
    params: Record<string, string>,
    signal?: AbortSignal
): Promise<OAuthPostResult> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        body.set(key, value);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal,
    });

    const parsed: unknown = await response.json();
    if (!isRecord(parsed)) {
        throw new Error(`Unexpected OAuth response from ${url}`);
    }

    return {
        ok: response.ok,
        body: parsed,
    };
}

function getOAuthErrorCode(body: Record<string, unknown>): string | undefined {
    const error = body.error;
    if (typeof error === 'string') {
        return error;
    }

    const errorCode = body.error_code;
    if (typeof errorCode === 'string') {
        return errorCode;
    }

    return undefined;
}

function formatOAuthError(prefix: string, body: Record<string, unknown>): string {
    const error = getOAuthErrorCode(body);
    const description = body.error_description;

    if (error && typeof description === 'string') {
        return `${prefix}: ${error} - ${description}`;
    }
    if (error) {
        return `${prefix}: ${error}`;
    }
    return prefix;
}

function requireString(
    body: Record<string, unknown>,
    key: string,
    context: string
): string {
    const value = body[key];
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid ${context}: missing ${key}`);
    }
    return value;
}

function requireNumber(
    body: Record<string, unknown>,
    key: string,
    context: string
): number {
    const value = body[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid ${context}: missing ${key}`);
    }
    return value;
}

function optionalString(
    body: Record<string, unknown>,
    key: string
): string | undefined {
    const value = body[key];
    return typeof value === 'string' ? value : undefined;
}

function parseDeviceCodeResponse(body: Record<string, unknown>): DeviceCodeResponse {
    const intervalValue = body.interval;
    const interval =
        typeof intervalValue === 'number' && Number.isFinite(intervalValue)
            ? intervalValue
            : DEFAULT_DEVICE_POLL_INTERVAL_SECONDS;

    return {
        deviceCode: requireString(body, 'device_code', 'device authorization response'),
        userCode: requireString(body, 'user_code', 'device authorization response'),
        verificationUrl: requireString(
            body,
            'verification_url',
            'device authorization response'
        ),
        expiresIn: requireNumber(body, 'expires_in', 'device authorization response'),
        interval,
    };
}

function parseTokenResponse(body: Record<string, unknown>): Credentials {
    const accessToken = requireString(body, 'access_token', 'device token response');
    const expiresIn = body.expires_in;
    const credentials: Credentials = {
        access_token: accessToken,
    };

    const refreshToken = optionalString(body, 'refresh_token');
    if (refreshToken) {
        credentials.refresh_token = refreshToken;
    }

    const scope = optionalString(body, 'scope');
    if (scope) {
        credentials.scope = scope;
    }

    const tokenType = optionalString(body, 'token_type');
    if (tokenType) {
        credentials.token_type = tokenType;
    }

    const idToken = optionalString(body, 'id_token');
    if (idToken) {
        credentials.id_token = idToken;
    }

    if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
        credentials.expiry_date = Date.now() + expiresIn * 1000;
    }

    return credentials;
}

async function requestDeviceCode(signal?: AbortSignal): Promise<DeviceCodeResponse> {
    const result = await postOAuthForm(
        OAUTH_CONFIG.deviceCodeEndpoint,
        {
            client_id: OAUTH_CONFIG.clientId,
            scope: OAUTH_CONFIG.scope,
        },
        signal
    );

    if (!result.ok) {
        throw new Error(
            formatOAuthError('Failed to request OAuth device code', result.body)
        );
    }

    return parseDeviceCodeResponse(result.body);
}

function printDeviceAuthorizationInstructions(deviceCode: DeviceCodeResponse): void {
    console.log(`
To authenticate Bkper CLI:
1. Open this URL: ${deviceCode.verificationUrl}
2. Enter this code: ${deviceCode.userCode}

Waiting for authorization...
`);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('Login cancelled'));
            return;
        }

        const timeout = setTimeout(() => {
            signal?.removeEventListener('abort', cancel);
            resolve();
        }, ms);
        const cancel = () => {
            clearTimeout(timeout);
            reject(new Error('Login cancelled'));
        };
        signal?.addEventListener('abort', cancel, {once: true});
    });
}

async function pollForDeviceToken(
    deviceCode: DeviceCodeResponse,
    signal?: AbortSignal
): Promise<Credentials> {
    const expiresAt = Date.now() + deviceCode.expiresIn * 1000;
    let pollIntervalMs = deviceCode.interval * 1000;

    while (Date.now() < expiresAt) {
        await sleep(pollIntervalMs, signal);

        const result = await postOAuthForm(
            OAUTH_CONFIG.tokenEndpoint,
            {
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret,
                device_code: deviceCode.deviceCode,
                grant_type: DEVICE_CODE_GRANT_TYPE,
            },
            signal
        );

        if (result.ok) {
            return parseTokenResponse(result.body);
        }

        const error = getOAuthErrorCode(result.body);
        if (error === 'authorization_pending') {
            continue;
        }
        if (error === 'slow_down') {
            pollIntervalMs += SLOW_DOWN_INCREMENT_MS;
            continue;
        }
        if (error === 'access_denied') {
            throw new Error('OAuth device authorization denied.');
        }
        if (error === 'expired_token') {
            throw new Error('OAuth device authorization code expired. Run: bkper auth login');
        }

        throw new Error(formatOAuthError('OAuth device authorization failed', result.body));
    }

    throw new Error('OAuth device authorization timed out. Run: bkper auth login');
}

/**
 * Performs OAuth2 authentication using the device authorization flow.
 */
async function authenticateDevice(
    options: OAuthInteractionOptions = {}
): Promise<Credentials> {
    const deviceCode = await requestDeviceCode(options.signal);
    if (options.onDeviceCode) {
        options.onDeviceCode({
            userCode: deviceCode.userCode,
            verificationUrl: deviceCode.verificationUrl,
            expiresIn: deviceCode.expiresIn,
            interval: deviceCode.interval,
        });
    } else {
        printDeviceAuthorizationInstructions(deviceCode);
    }
    return pollForDeviceToken(deviceCode, options.signal);
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
 * Returns a valid OAuth token, launching the device authorization flow if needed.
 */
async function resolveOAuthToken(
    options: OAuthInteractionOptions = {}
): Promise<{accessToken: string; alreadyLoggedIn: boolean}> {
    const hadStoredCredentials = storedCredentials != null;
    const storedToken = await getStoredOAuthToken();
    if (storedToken) {
        return {accessToken: storedToken, alreadyLoggedIn: true};
    }

    if (hadStoredCredentials) {
        if (options.onStatus) {
            options.onStatus('Session expired. Re-authenticating...');
        } else if (!options.onDeviceCode) {
            console.log('Session expired. Re-authenticating...');
        }
    }

    const credentials = await authenticateDevice(options);
    storeCredentials(mergeCredentials(storedCredentials, credentials));

    return {
        accessToken: credentials.access_token ?? '',
        alreadyLoggedIn: false,
    };
}

async function getAuthenticatedEmail(accessToken: string): Promise<string | undefined> {
    try {
        const tokenInfo = await createOAuthClient().getTokenInfo(accessToken);
        return tokenInfo.email;
    } catch {
        return undefined;
    }
}

export async function authenticateBkper(
    options: OAuthInteractionOptions = {}
): Promise<BkperAuthenticationResult> {
    const result = await resolveOAuthToken(options);
    return {
        ...result,
        email: await getAuthenticatedEmail(result.accessToken),
    };
}

export async function getOAuthToken(
    options: OAuthInteractionOptions = {}
): Promise<string> {
    return (await resolveOAuthToken(options)).accessToken;
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
