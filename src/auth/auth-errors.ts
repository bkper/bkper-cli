import { BkperError } from 'bkper-js';

export const AUTHENTICATION_REQUIRED_MESSAGE =
    'Authentication required. Run: bkper auth login';

interface ErrorWithNestedAuthInfo {
    error?: {
        code?: unknown;
        message?: unknown;
    };
}

/**
 * Detects whether an error represents a missing or invalid authentication state.
 */
export function isAuthenticationError(error: unknown): boolean {
    if (error instanceof BkperError) {
        const message = error.message.toLowerCase();
        return (
            error.code === 401 ||
            (error.code === 403 &&
                (message.includes('login required') ||
                    message.includes('authentication required') ||
                    message.includes('invalid or expired token')))
        );
    }

    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const nested = (error as ErrorWithNestedAuthInfo).error;
    const code = typeof nested?.code === 'string' ? nested.code.toUpperCase() : undefined;
    const message =
        typeof nested?.message === 'string' ? nested.message.toLowerCase() : undefined;

    if (code && (code.includes('TOKEN') || code.includes('AUTH'))) {
        return true;
    }

    if (
        message &&
        (message.includes('token') ||
            message.includes('authentication') ||
            message.includes('login required'))
    ) {
        return true;
    }

    return false;
}
