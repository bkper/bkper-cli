export const AUTHENTICATION_REQUIRED_MESSAGE =
    'Authentication required. Run: bkper auth login';

interface ErrorWithNestedAuthInfo {
    message?: unknown;
    error?: {
        message?: unknown;
    };
}

function normalizeMessage(message: unknown): string | undefined {
    if (typeof message !== 'string') {
        return undefined;
    }

    const trimmed = message.trim();
    return trimmed ? trimmed : undefined;
}

/**
 * Extracts a concise human-readable message from CLI and API errors.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (typeof error !== 'object' || error === null) {
        return String(error);
    }

    const typedError = error as ErrorWithNestedAuthInfo;
    const nestedMessage = normalizeMessage(typedError.error?.message);
    if (nestedMessage) {
        return nestedMessage;
    }

    const topLevelMessage = normalizeMessage(typedError.message);
    if (topLevelMessage) {
        return topLevelMessage;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}
