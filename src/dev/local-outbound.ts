import { AUTHENTICATION_REQUIRED_MESSAGE } from '../auth/auth-errors.js';
import { getStoredOAuthToken } from '../auth/local-auth-service.js';

const PUBLIC_BKPER_API_HOST = 'api.bkper.app';
const PLATFORM_SESSION_COOKIE_NAMES = new Set([
    'bkper_session',
    'bkper_session_dev',
    'bkper_session_local',
]);

export type LocalOutboundService = (request: Request) => Promise<Response>;

export interface LocalOutboundOptions {
    appId: string;
    getAccessToken?: () => Promise<string | undefined>;
    forwardFetch?: (request: Request) => Promise<Response>;
}

interface RequestInitWithDuplex extends RequestInit {
    duplex?: 'half';
}

export function createLocalOutboundService(options: LocalOutboundOptions): LocalOutboundService {
    const getAccessToken = options.getAccessToken ?? getStoredOAuthToken;
    const forwardFetch = options.forwardFetch ?? ((request: Request) => fetch(request));

    return async (request: Request): Promise<Response> => {
        if (!isAllowedBkperApiRequest(request)) {
            return forwardFetch(request);
        }

        const accessToken = normalizeBearerToken(await getAccessToken());
        if (!accessToken) {
            return new Response(JSON.stringify({ error: AUTHENTICATION_REQUIRED_MESSAGE }), {
                status: 401,
                headers: { 'content-type': 'application/json' },
            });
        }

        const headers = new Headers(request.headers);
        headers.set('Authorization', `Bearer ${accessToken}`);
        headers.set('bkper-agent-id', options.appId);
        stripPlatformCookieHeaders(headers);

        return forwardFetch(createForwardRequest(request, headers));
    };
}

function createForwardRequest(request: Request, headers: Headers): Request {
    const init: RequestInitWithDuplex = {
        method: request.method,
        headers,
        redirect: 'manual',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
        if (request.body) {
            init.duplex = 'half';
        }
    }

    return new Request(request.url, init);
}

function isAllowedBkperApiRequest(request: Request): boolean {
    const url = new URL(request.url);
    return url.protocol === 'https:' && url.host === PUBLIC_BKPER_API_HOST;
}

function normalizeBearerToken(token: string | undefined): string | undefined {
    const trimmed = token?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.replace(/^bearer\s+/i, '');
}

function stripPlatformCookieHeaders(headers: Headers): void {
    const cookie = headers.get('Cookie');
    if (!cookie) {
        return;
    }

    const filtered = cookie
        .split(';')
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .filter(part => !isPlatformCookiePair(part))
        .join('; ');

    if (filtered) {
        headers.set('Cookie', filtered);
    } else {
        headers.delete('Cookie');
    }
}

function isPlatformCookiePair(cookiePair: string): boolean {
    const cookieName = cookiePair.split('=', 1)[0]?.trim().toLowerCase();
    return PLATFORM_SESSION_COOKIE_NAMES.has(cookieName);
}
