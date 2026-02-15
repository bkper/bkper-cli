import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CLI_PATH = path.resolve(import.meta.dirname, '../../../lib/cli.js');
const DEFAULT_API_URL = 'http://localhost:8081/_ah/api/bkper';

/**
 * Get the API URL from environment or default to localhost.
 */
export function getApiUrl(): string {
    return process.env.BKPER_API_URL || DEFAULT_API_URL;
}

/**
 * Get OAuth token from stored credentials (requires prior `bkper login`).
 */
export async function getOAuthToken(): Promise<string> {
    const configDir = path.join(os.homedir(), '.config', 'bkper');
    const credentialsPath = path.join(configDir, '.bkper-credentials.json');

    if (!fs.existsSync(credentialsPath)) {
        throw new Error(
            'No stored credentials found. Run `bkper login` first.\n' +
                `Expected credentials at: ${credentialsPath}`
        );
    }

    const { OAuth2Client } = await import('google-auth-library');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    const oAuth2Client = new OAuth2Client({
        clientId: '927657669669-ig60i5ic9i9esdc8q59plardm11fuubc.apps.googleusercontent.com',
        clientSecret: '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',
        redirectUri: 'http://localhost:3000/oauth2callback',
    });
    oAuth2Client.setCredentials(credentials);

    const tokenResponse = await oAuth2Client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error('Failed to get access token. Try running `bkper login` again.');
    }
    return tokenResponse.token;
}

/**
 * Check if the API is reachable and the user is authenticated.
 *
 * Performs a lightweight authenticated request to verify both
 * network connectivity and valid credentials in a single call.
 */
export async function isApiAvailable(): Promise<boolean> {
    try {
        const apiUrl = getApiUrl();
        const token = await getOAuthToken();
        const response = await fetch(`${apiUrl}/v5/books`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Make an authenticated REST API request.
 */
async function apiRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
): Promise<Response> {
    const apiUrl = getApiUrl();
    const token = await getOAuthToken();
    const url = `${apiUrl}/${endpoint}`;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const apiKey = process.env.BKPER_API_KEY;
    if (apiKey) {
        headers['bkper-api-key'] = apiKey;
    }

    return fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
    });
}

/**
 * Create a test book via REST API.
 * Returns the book ID.
 *
 * Waits for the book to become accessible via GET (datastore eventual consistency)
 * before returning, so subsequent CLI commands can use it immediately.
 */
export async function createTestBook(name: string): Promise<string> {
    const book = await runBkperJson<bkper.Book>(['book', 'create', '--name', name]);
    const bookId = book.id!;

    // Wait for book to become accessible (datastore eventual consistency)
    const maxRetries = 10;
    const retryDelay = 500;
    for (let i = 0; i < maxRetries; i++) {
        try {
            await runBkperJson<bkper.Book>(['book', 'get', bookId]);
            return bookId;
        } catch {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    // Return the ID even if verification failed — let tests report the actual error
    console.warn(
        `Warning: Book ${bookId} created but not yet accessible after ${maxRetries} retries`
    );
    return bookId;
}

/**
 * Delete a test book via REST API.
 */
export async function deleteTestBook(bookId: string): Promise<void> {
    try {
        const response = await apiRequest('DELETE', `v5/books/${bookId}`);
        if (!response.ok) {
            console.warn(`Warning: Failed to delete test book ${bookId}: ${response.status}`);
        }
    } catch (err) {
        console.warn(`Warning: Failed to delete test book ${bookId}:`, err);
    }
}

/**
 * Result from running a CLI command.
 */
export interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Run a bkper CLI command and capture output.
 *
 * Spawns `node lib/cli.js` with the given args and returns
 * stdout, stderr, and exit code.
 */
export function runBkper(
    args: string[],
    envOverrides?: Record<string, string>
): Promise<CliResult> {
    const apiUrl = getApiUrl();

    return new Promise((resolve, reject) => {
        const child = execFile(
            'node',
            [CLI_PATH, ...args],
            {
                cwd: path.resolve(import.meta.dirname, '../../..'),
                env: {
                    ...process.env,
                    BKPER_API_URL: apiUrl,
                    ...envOverrides,
                },
                timeout: 30000,
                maxBuffer: 1024 * 1024,
            },
            (error, stdout, stderr) => {
                resolve({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exitCode:
                        error?.code != null ? (typeof error.code === 'number' ? error.code : 1) : 0,
                });
            }
        );

        // Close stdin immediately so CLI commands that check for piped input
        // (account create, group create, transaction create) don't hang
        // waiting for data that will never come.
        if (child.stdin) {
            child.stdin.end();
        }
    });
}

/**
 * Run a bkper CLI command and parse the JSON output.
 * Throws if the command fails or output is not valid JSON.
 */
export async function runBkperJson<T = unknown>(
    args: string[],
    envOverrides?: Record<string, string>
): Promise<T> {
    const result = await runBkper(['--json', ...args], envOverrides);

    if (result.exitCode !== 0) {
        throw new Error(
            `CLI command failed (exit ${result.exitCode}):\n` +
                `  args: ${args.join(' ')}\n` +
                `  stderr: ${result.stderr}\n` +
                `  stdout: ${result.stdout}`
        );
    }

    try {
        return JSON.parse(result.stdout) as T;
    } catch {
        throw new Error(
            `Failed to parse CLI JSON output:\n` +
                `  args: ${args.join(' ')}\n` +
                `  stdout: ${result.stdout}\n` +
                `  stderr: ${result.stderr}`
        );
    }
}

/**
 * Run a bkper CLI command with stdin data piped in.
 *
 * Spawns `node lib/cli.js` with the given args and pipes stdinData
 * to the child process's stdin. Returns stdout, stderr, and exit code.
 */
export function runBkperWithStdin(
    args: string[],
    stdinData: string,
    envOverrides?: Record<string, string>
): Promise<CliResult> {
    const apiUrl = getApiUrl();

    return new Promise((resolve, reject) => {
        const child = execFile(
            'node',
            [CLI_PATH, ...args],
            {
                cwd: path.resolve(import.meta.dirname, '../../..'),
                env: {
                    ...process.env,
                    BKPER_API_URL: apiUrl,
                    ...envOverrides,
                },
                timeout: 30000,
                maxBuffer: 1024 * 1024,
            },
            (error, stdout, stderr) => {
                resolve({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exitCode:
                        error?.code != null ? (typeof error.code === 'number' ? error.code : 1) : 0,
                });
            }
        );

        // Write stdin data and close the stream
        if (child.stdin) {
            child.stdin.write(stdinData);
            child.stdin.end();
        }
    });
}

/**
 * Generate a unique test name to avoid collisions between parallel runs.
 */
export function uniqueTestName(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
}
