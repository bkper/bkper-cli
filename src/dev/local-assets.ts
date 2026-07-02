export type LocalAssetsService = (request: Request) => Promise<Response>;

export interface LocalAssetsOptions {
    host?: string;
    port?: number;
    forwardFetch?: (request: Request) => Promise<Response>;
}

interface RequestInitWithDuplex extends RequestInit {
    duplex?: 'half';
}

const DEFAULT_LOCAL_ASSET_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];
const RETRIABLE_LOCAL_ASSET_FETCH_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
]);

/**
 * Creates a local ASSETS service binding that forwards static asset requests to Vite.
 *
 * In development, the app Worker still handles the browser-facing request on
 * localhost:8787. When app code calls env.ASSETS.fetch(), this service proxies
 * the request to the Vite dev server so client HMR remains Vite-powered.
 */
export function createLocalAssetsService(options: LocalAssetsOptions = {}): LocalAssetsService {
    const hosts = resolveLocalAssetHosts(options.host);
    const port = options.port ?? 5173;
    const forwardFetch = options.forwardFetch ?? ((request: Request) => fetch(request));

    return async (request: Request): Promise<Response> => {
        const body = await readForwardBody(request);

        for (let index = 0; index < hosts.length; index++) {
            const host = hosts[index];
            try {
                return await forwardFetch(createForwardRequest(request, host, port, body));
            } catch (err) {
                const isLastHost = index === hosts.length - 1;
                if (isLastHost || !isRetriableLocalAssetFetchError(err)) {
                    throw err;
                }
            }
        }

        throw new Error('Unable to forward local asset request');
    };
}

function resolveLocalAssetHosts(host: string | undefined): string[] {
    const primaryHost = normalizeLocalAssetHost(host ?? 'localhost');

    if (!isLoopbackHost(primaryHost)) {
        return [primaryHost];
    }

    return [
        primaryHost,
        ...DEFAULT_LOCAL_ASSET_HOSTS.filter(candidate => candidate !== primaryHost),
    ];
}

function normalizeLocalAssetHost(host: string): string {
    const trimmedHost = host.trim();
    return trimmedHost === '::1' ? '[::1]' : trimmedHost;
}

function isLoopbackHost(host: string): boolean {
    const normalizedHost = normalizeLocalAssetHost(host).toLowerCase();
    return DEFAULT_LOCAL_ASSET_HOSTS.includes(normalizedHost);
}

async function readForwardBody(request: Request): Promise<ArrayBuffer | undefined> {
    if (request.method === 'GET' || request.method === 'HEAD' || !request.body) {
        return undefined;
    }

    return request.arrayBuffer();
}

function createForwardRequest(
    request: Request,
    host: string,
    port: number,
    body: ArrayBuffer | undefined
): Request {
    const targetUrl = new URL(request.url);
    targetUrl.protocol = 'http:';
    targetUrl.hostname = host;
    targetUrl.port = String(port);

    const headers = new Headers(request.headers);
    headers.delete('host');

    const init: RequestInitWithDuplex = {
        method: request.method,
        headers,
        redirect: 'manual',
    };

    if (body) {
        init.body = body.slice(0);
        init.duplex = 'half';
    }

    return new Request(targetUrl, init);
}

function isRetriableLocalAssetFetchError(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code) {
        return RETRIABLE_LOCAL_ASSET_FETCH_ERROR_CODES.has(code);
    }

    return error instanceof TypeError;
}

function getErrorCode(error: unknown): string | undefined {
    const candidates = [error];
    if (isRecord(error) && 'cause' in error) {
        candidates.push(error.cause);
    }

    for (const candidate of candidates) {
        if (isRecord(candidate) && typeof candidate.code === 'string') {
            return candidate.code;
        }
    }

    return undefined;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}
