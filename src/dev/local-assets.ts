export type LocalAssetsService = (request: Request) => Promise<Response>;

export interface LocalAssetsOptions {
    host?: string;
    port?: number;
    forwardFetch?: (request: Request) => Promise<Response>;
}

interface RequestInitWithDuplex extends RequestInit {
    duplex?: 'half';
}

/**
 * Creates a local ASSETS service binding that forwards static asset requests to Vite.
 *
 * In development, the app Worker still handles the browser-facing request on
 * localhost:8787. When app code calls env.ASSETS.fetch(), this service proxies
 * the request to the Vite dev server so client HMR remains Vite-powered.
 */
export function createLocalAssetsService(options: LocalAssetsOptions = {}): LocalAssetsService {
    const host = options.host ?? 'localhost';
    const port = options.port ?? 5173;
    const forwardFetch = options.forwardFetch ?? ((request: Request) => fetch(request));

    return async (request: Request): Promise<Response> => {
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

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            init.body = request.body;
            if (request.body) {
                init.duplex = 'half';
            }
        }

        return forwardFetch(new Request(targetUrl, init));
    };
}
