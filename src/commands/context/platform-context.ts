import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../auth/auth-errors.js';
import {getStoredOAuthToken} from '../../auth/local-auth-service.js';

const PLATFORM_API_URL = process.env.BKPER_PLATFORM_URL || 'https://platform.bkper.app';

export type ContextAccess = 'read' | 'write';
/**
 * An agent context scope, as Platform's routes name it: the signed-in user's own, their verified domain's (`domain`: Platform
 * takes which from Bkper, never from here), or a Book's (`books/<bookId>`).
 */
export type ContextScope = 'user' | 'domain' | `books/${string}`;
/** Bkper Book IDs: never a path. */
export const BOOK_ID = /^[A-Za-z0-9_-]{1,128}$/;
export function isContextScope(value: string): value is ContextScope {
    return value === 'user' || value === 'domain' || (value.startsWith('books/') && BOOK_ID.test(value.slice('books/'.length)));
}
/** A five-minute repository credential. Sensitive: never log, store or print the token outside Git's helper protocol. */
export interface ContextCredential {
    token: string;
    scope: ContextAccess;
    expiresAt: string;
    remote: string;
}

/** Agent context repositories on the environment's Platform (one Git repository per scope). */
export interface PlatformContextApi {
    /**
     * A credential for a context repository: the signed-in user's own (the default), their domain's (read for its members,
     * write for its admin), or a Book's, which Platform issues only as far as the person's Book permission allows (read to view,
     * write to edit). A write credential creates the repository
     * on the first push; a read before that returns only the remote it will have.
     */
    issueCredential(access: ContextAccess, scope?: ContextScope): Promise<ContextCredential | {remote: string}>;
}

export class ContextError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContextError';
    }
}

/** Platform refused: the person's access to the Book, or to their domain's context, does not allow it. */
export class ContextForbiddenError extends ContextError {
    constructor(scope?: ContextScope) {
        super(
            scope === 'domain'
                ? "Only people in a company domain read its agent context, and only the domain's admin publishes it."
                : "Your access to this Book does not allow this on its agent context. Ask the Book's owner to share it with you."
        );
        this.name = 'ContextForbiddenError';
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
        async issueCredential(access, scope = 'user') {
            const token = await dependencies.getToken();
            if (!token) {
                throw new ContextError(AUTHENTICATION_REQUIRED_MESSAGE);
            }
            if (!isContextScope(scope)) {
                throw new ContextError(`Unknown agent context scope '${scope}'.`);
            }
            const response = await dependencies.fetch(`${PLATFORM_API_URL}/api/context/${scope}/credentials`, {
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
            if (response.status === 403) {
                throw new ContextForbiddenError(scope);
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
