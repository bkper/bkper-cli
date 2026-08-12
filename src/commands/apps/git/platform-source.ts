import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../../auth/auth-errors.js';
import {getStoredOAuthToken} from '../../../auth/local-auth-service.js';
import {createPlatformClient} from '../../../platform/client.js';
import {
    ManagedGitError,
    type ManagedSourceActivationResult,
    type ManagedSourceCredential,
    type ManagedSourcePlatformStatus,
} from './types.js';

const PLATFORM_API_URL = process.env.BKPER_PLATFORM_URL || 'https://platform.bkper.app';

export interface PlatformSourceApi {
    getStatus(
        appId: string
    ): Promise<ManagedSourcePlatformStatus | 'feature_disabled' | 'app_not_found'>;
    activate(appId: string, activationId: string): Promise<ManagedSourceActivationResult>;
    issueCredential(
        appId: string,
        scope: 'read' | 'write'
    ): Promise<ManagedSourceCredential>;
}

interface PlatformErrorBody {
    success?: false;
    error?: {
        code?: string;
        message?: string;
        details?: {retryable?: boolean; [key: string]: unknown};
    };
}

function redactSecrets(value: string): string {
    return value
        .replace(/(password=)[^\n\r]*/gi, '$1[redacted]')
        .replace(
            /(Bearer\s+)[A-Za-z0-9._\-]+/gi,
            '$1[redacted]'
        )
        .replace(
            /([?&]token=)[^&\s]+/gi,
            '$1[redacted]'
        );
}

function asErrorMessage(body: PlatformErrorBody | undefined, fallback: string): string {
    const message = body?.error?.message ?? fallback;
    return redactSecrets(message);
}

async function authorizedFetch(
    path: string,
    init: RequestInit = {},
    requireAuthentication = true
): Promise<{response: Response; body: unknown}> {
    const token = await getStoredOAuthToken();
    if (!token && requireAuthentication) {
        throw new ManagedGitError('AUTHENTICATION_REQUIRED', AUTHENTICATION_REQUIRED_MESSAGE);
    }

    const response = await fetch(`${PLATFORM_API_URL}${path}`, {
        ...init,
        headers: {
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            Accept: 'application/json',
            ...(init.body ? {'Content-Type': 'application/json'} : {}),
            ...(init.headers ?? {}),
        },
    });

    let body: unknown = undefined;
    const text = await response.text();
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = undefined;
        }
    }
    return {response, body};
}

function throwPlatformError(
    response: Response,
    body: PlatformErrorBody | undefined,
    fallback: string
): never {
    const code = body?.error?.code;
    const message = asErrorMessage(body, fallback);

    if (response.status === 401 || code === 'MISSING_TOKEN' || code === 'INVALID_TOKEN') {
        throw new ManagedGitError(
            'AUTHENTICATION_REQUIRED',
            `${AUTHENTICATION_REQUIRED_MESSAGE}${message ? ` (${message})` : ''}`
        );
    }
    if (code === 'SOURCE_FEATURE_DISABLED' || response.status === 503) {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'Managed source control is not enabled in this Platform environment.'
        );
    }
    if (code === 'SOURCE_RECORD_MISSING' || response.status === 409) {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            message ||
                'Managed source record is missing or mismatched. Retry if this is a transient lookup, or request owner/developer access.'
        );
    }
    if (response.status === 403 || code === 'ACCESS_DENIED') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            message ||
                'You do not have owner/developer access to this managed source. Request access from the App owner.'
        );
    }
    if (response.status === 404 || code === 'APP_NOT_FOUND') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            message || 'App not found for managed source.'
        );
    }

    throw new ManagedGitError('MANAGED_SOURCE_UNAVAILABLE', message || fallback);
}

export function createPlatformSourceApi(): PlatformSourceApi {
    return {
        async getStatus(appId: string) {
            const {response, body} = await authorizedFetch(
                `/api/apps/${encodeURIComponent(appId)}/source`,
                {},
                false
            );
            const errorBody = body as PlatformErrorBody | undefined;
            if (response.status === 503 || errorBody?.error?.code === 'SOURCE_FEATURE_DISABLED') {
                return 'feature_disabled';
            }
            if (response.status === 404 || errorBody?.error?.code === 'APP_NOT_FOUND') {
                return 'app_not_found';
            }
            if (!response.ok) {
                throwPlatformError(response, errorBody, 'Failed to load managed source status.');
            }
            const status = body as ManagedSourcePlatformStatus;
            if (
                status?.mode === 'managed' &&
                (typeof status.remote !== 'string' || status.remote.length === 0)
            ) {
                throw new ManagedGitError(
                    'MANAGED_SOURCE_UNAVAILABLE',
                    'Managed source status did not include the registered remote.'
                );
            }
            return status;
        },

        async activate(appId: string, activationId: string) {
            const {response, body} = await authorizedFetch(
                `/api/apps/${encodeURIComponent(appId)}/source/activate`,
                {
                    method: 'POST',
                    body: JSON.stringify({activationId}),
                }
            );
            const errorBody = body as PlatformErrorBody | undefined;
            if (!response.ok) {
                throwPlatformError(response, errorBody, 'Failed to activate managed source.');
            }
            const result = body as ManagedSourceActivationResult;
            if (
                !result?.success ||
                result.source?.appId !== appId ||
                typeof result.source.remote !== 'string'
            ) {
                throw new ManagedGitError(
                    'MANAGED_SOURCE_UNAVAILABLE',
                    'Managed source activation response was invalid.'
                );
            }
            return result;
        },

        async issueCredential(appId: string, scope: 'read' | 'write') {
            const {response, body} = await authorizedFetch(
                `/api/apps/${encodeURIComponent(appId)}/source/credentials`,
                {
                    method: 'POST',
                    body: JSON.stringify({scope}),
                }
            );
            const errorBody = body as PlatformErrorBody | undefined;
            if (!response.ok) {
                throwPlatformError(
                    response,
                    errorBody,
                    'Failed to issue managed source credentials.'
                );
            }
            const credential = body as ManagedSourceCredential;
            if (
                !credential ||
                typeof credential.token !== 'string' ||
                typeof credential.remote !== 'string'
            ) {
                throw new ManagedGitError(
                    'MANAGED_SOURCE_UNAVAILABLE',
                    'Managed source credential response was invalid.'
                );
            }
            return credential;
        },
    };
}

/**
 * Ensures the platform client module remains the auth base for non-source routes.
 * Source operations keep a small fetch wrapper for explicit no-store and token-redaction handling.
 */
export function getPlatformBaseUrl(): string {
    createPlatformClient();
    return PLATFORM_API_URL;
}

/**
 * Strips provider query suffixes from repository tokens before handing them to Git.
 * Never log the returned secret.
 */
export function stripRepositoryTokenSecret(token: string): string {
    const queryIndex = token.indexOf('?');
    return queryIndex === -1 ? token : token.slice(0, queryIndex);
}
