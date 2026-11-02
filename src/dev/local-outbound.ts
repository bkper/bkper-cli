import { AUTHENTICATION_REQUIRED_MESSAGE } from '../auth/auth-errors.js';
import { getStoredOAuthToken } from '../auth/local-auth-service.js';
import { isManagedSandbox } from './managed-sandbox.js';

const PUBLIC_BKPER_API_HOST = 'api.bkper.app';
const BKPER_AI_HOSTS = new Set(['ai.bkper.app', 'ai-dev.bkper.app']);
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
    /**
     * In the managed sandbox, Bkper API and AI requests go out without credentials (its egress adds
     * the owner's), and Bkper API requests go to the host of `bkperApiUrl` when set.
     */
    managedSandbox?: boolean;
    /** The sandbox's Bkper API (`BKPER_API_URL`); its egress refuses the other environment's. */
    bkperApiUrl?: string;
}

interface RequestInitWithDuplex extends RequestInit {
    duplex?: 'half';
}

export function createLocalOutboundService(options: LocalOutboundOptions): LocalOutboundService {
    const getAccessToken = options.getAccessToken ?? getStoredOAuthToken;
    const forwardFetch = options.forwardFetch ?? ((request: Request) => fetch(request));
    const managedSandbox = options.managedSandbox ?? isManagedSandbox();
    const bkperApiUrl = options.bkperApiUrl ?? process.env.BKPER_API_URL;
    const managedApiOrigin =
        managedSandbox && bkperApiUrl ? new URL(bkperApiUrl).origin : undefined;

    return async (request: Request): Promise<Response> => {
        const service = getAuthorizedBkperService(request);
        if (!service) {
            return forwardFetch(
                createForwardRequest(request, new Headers(request.headers), request.redirect)
            );
        }

        const headers = new Headers(request.headers);
        let url = request.url;
        if (managedSandbox) {
            headers.delete('Authorization');
            if (service === 'api' && managedApiOrigin) {
                const target = new URL(request.url);
                url = `${managedApiOrigin}${target.pathname}${target.search}`;
            }
        } else {
            const accessToken = normalizeBearerToken(await getAccessToken());
            if (!accessToken) {
                return new Response(JSON.stringify({ error: AUTHENTICATION_REQUIRED_MESSAGE }), {
                    status: 401,
                    headers: { 'content-type': 'application/json' },
                });
            }
            headers.set('Authorization', `Bearer ${accessToken}`);
        }
        headers.set('bkper-agent-id', options.appId);
        if (service === 'ai') {
            headers.set('bkper-ai-source', options.appId);
        }
        stripPlatformCookieHeaders(headers);

        return forwardFetch(createForwardRequest(request, headers, 'manual', url));
    };
}

function createForwardRequest(
    request: Request,
    headers: Headers,
    redirect: Request['redirect'],
    url = request.url
): Request {
    const init: RequestInitWithDuplex = {
        method: request.method,
        headers,
        redirect,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
        if (request.body) {
            init.duplex = 'half';
        }
    }

    return new Request(url, init);
}

function getAuthorizedBkperService(request: Request): 'api' | 'ai' | undefined {
    const url = new URL(request.url);
    if (url.protocol !== 'https:') {
        return undefined;
    }
    if (url.host === PUBLIC_BKPER_API_HOST) {
        return 'api';
    }
    if (BKPER_AI_HOSTS.has(url.host)) {
        return 'ai';
    }
    return undefined;
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
