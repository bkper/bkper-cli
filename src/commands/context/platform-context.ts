import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../auth/auth-errors.js';
import {getStoredOAuthToken} from '../../auth/local-auth-service.js';

const PLATFORM_API_URL = process.env.BKPER_PLATFORM_URL || 'https://platform.bkper.app';

export type ContextAccess = 'read' | 'write';
/** A five-minute repository credential. Sensitive: never log, store or print the token outside Git's helper protocol. */
export interface ContextCredential {
    token: string;
    scope: ContextAccess;
    expiresAt: string;
    remote: string;
}

/** The user's agent context repository on the environment's Platform (one Git repository per scope). */
export interface PlatformContextApi {
    /**
     * A credential for the signed-in user's own context repository. A write credential creates the repository on the
     * first push; a read before that returns only the remote it will have.
     */
    issueCredential(access: ContextAccess): Promise<ContextCredential | {remote: string}>;
}

export class ContextError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContextError';
    }
}

export interface PlatformContextDependencies {
    getToken(): Promise<string | undefined>;
    fetch(input: string, init: RequestInit): Promise<Response>;
}

const defaultDependencies: PlatformContextDependencies = {
    getToken: getStoredOAuthToken,
    fetch: (input, init) => fetch(input, init),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/** Context credentials are issued only to a stored login. */
export function createPlatformContextApi(
    dependencies: PlatformContextDependencies = defaultDependencies
): PlatformContextApi {
    return {
        async issueCredential(access) {
            const token = await dependencies.getToken();
            if (!token) {
                throw new ContextError(AUTHENTICATION_REQUIRED_MESSAGE);
            }
            const response = await dependencies.fetch(`${PLATFORM_API_URL}/api/context/user/credentials`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({scope: access}),
            });
            const body: unknown = await response.json().catch(() => undefined);
            const error = isRecord(body) && isRecord(body.error) ? body.error : undefined;
            const details = error && isRecord(error.details) ? error.details : undefined;
            if (response.status === 404 && error?.code === 'CONTEXT_NOT_FOUND' && typeof details?.remote === 'string') {
                return {remote: details.remote};
            }
            if (response.status === 401) {
                throw new ContextError(AUTHENTICATION_REQUIRED_MESSAGE);
            }
            if (
                response.status !== 201 ||
                !isRecord(body) ||
                typeof body.token !== 'string' ||
                typeof body.remote !== 'string' ||
                typeof body.expiresAt !== 'string' ||
                body.scope !== access
            ) {
                throw new ContextError(`Agent context is unavailable (HTTP ${response.status}).`);
            }
            return {token: body.token, scope: access, expiresAt: body.expiresAt, remote: body.remote};
        },
    };
}
