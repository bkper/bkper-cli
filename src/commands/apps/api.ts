import { getStoredOAuthToken } from '../../auth/local-auth-service.js';

/**
 * Calls the HTTP API an installed app publishes on its Bkper host, as the signed-in user.
 *
 * The CLI adds the stored login when it has one. Without one (as in the managed agent's sandbox),
 * it sends no credentials, so an external proxy can add them.
 */

export interface AppApiTarget {
    /** Use the app's preview host. */
    preview?: boolean;
}

export interface AppApiRequestOptions extends AppApiTarget {
    /** HTTP method; defaults to GET, or POST when data is sent, like curl. */
    method?: string;
    /** JSON request body. */
    data?: string;
}

export interface AppApiDependencies {
    fetch(url: string, init: RequestInit): Promise<Response>;
    getStoredOAuthToken(): Promise<string | undefined>;
}

const defaultDependencies: AppApiDependencies = {
    fetch: (url, init) => fetch(url, init),
    getStoredOAuthToken,
};

/** One DNS label, as in `{appId}.bkper.app`. */
const APP_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const API_PATH_PREFIX = '/api/';
const MAX_ERROR_TEXT = 300;

function appOrigin(appId: string, preview = false): string {
    if (!APP_ID.test(appId)) {
        throw new Error(`Invalid app ID: ${appId}`);
    }
    return `https://${appId}${preview ? '-preview' : ''}.bkper.app`;
}

/** Resolves a spec path on the app's own host, refusing anything outside its /api/ routes. */
function apiUrl(origin: string, path: string): string {
    const invalid = new Error(
        `App API paths must start with ${API_PATH_PREFIX} on the app's own host: ${path}`
    );
    if (!path.startsWith('/')) {
        throw invalid;
    }
    let url: URL;
    try {
        url = new URL(path, origin);
    } catch {
        throw invalid;
    }
    // URL parsing resolves dot segments, so `/api/../events` is checked as `/events`.
    if (url.origin !== origin || !url.pathname.startsWith(API_PATH_PREFIX)) {
        throw invalid;
    }
    return url.href;
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The app's own error message: `{error: {message}}`, `{error: "..."}` or `{message}`. */
function errorMessage(response: Response, text: string): string {
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        return `Redirect${location ? ` to ${location}` : ''} not followed`;
    }
    const body = parseJson(text);
    if (isRecord(body)) {
        const error = body.error;
        if (isRecord(error) && typeof error.message === 'string') return error.message;
        if (typeof error === 'string') return error;
        if (typeof body.message === 'string') return body.message;
    }
    const trimmed = text.trim();
    if (trimmed) {
        return trimmed.length > MAX_ERROR_TEXT ? `${trimmed.slice(0, MAX_ERROR_TEXT)}…` : trimmed;
    }
    return response.statusText;
}

/**
 * Returns the OpenAPI spec an app publishes at `/openapi.json`. The spec is public, so no
 * credentials are sent.
 */
export async function getAppApiSpec(
    appId: string,
    options: AppApiTarget = {},
    dependencies: AppApiDependencies = defaultDependencies
): Promise<Record<string, unknown>> {
    const url = `${appOrigin(appId, options.preview)}/openapi.json`;
    const response = await dependencies.fetch(url, {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
    });
    const text = await response.text();
    // Apps without a spec answer with their web page or a 404.
    const spec = response.ok ? parseJson(text) : undefined;
    if (!isRecord(spec) || typeof spec.openapi !== 'string') {
        throw new Error(`${appId} does not publish an OpenAPI spec`);
    }
    return spec;
}

/**
 * Sends one request to an app's `/api/` routes and returns the response body as text.
 * Fails with the status and the app's error message on any non-2xx response.
 */
export async function requestAppApi(
    appId: string,
    path: string,
    options: AppApiRequestOptions = {},
    dependencies: AppApiDependencies = defaultDependencies
): Promise<string> {
    const url = apiUrl(appOrigin(appId, options.preview), path);
    const data = options.data;
    if (data !== undefined && parseJson(data) === undefined) {
        throw new Error('Request data must be valid JSON');
    }
    const method = (options.method ?? (data !== undefined ? 'POST' : 'GET')).toUpperCase();
    if (!/^[A-Z]+$/.test(method)) {
        throw new Error(`Invalid HTTP method: ${options.method}`);
    }

    const token = await dependencies.getStoredOAuthToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';

    const response = await dependencies.fetch(url, {
        method,
        headers,
        body: data,
        redirect: 'manual',
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${response.status} ${errorMessage(response, text)}`);
    }
    return text;
}

/**
 * Formats an app response for stdout: JSON compact, or pretty for a person; other bodies as
 * they are; nothing for an empty body.
 */
export function formatAppResponse(text: string, pretty: boolean): string | undefined {
    if (!text) return undefined;
    const body = parseJson(text);
    if (body === undefined) return text;
    return pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
}
