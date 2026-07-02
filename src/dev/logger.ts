/**
 * Logger utilities for dev server output
 * Provides prefixed, colored output for different subsystems
 */

export type LogPrefix = 'server' | 'client' | 'build' | 'types' | 'shared';

export interface Logger {
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}

/**
 * Icon mapping for different log types
 */
const icons = {
    success: '\u2705',
    warn: '\u26A0\uFE0F ',
    error: '\u274C',
    reload: '\uD83D\uDD04',
    build: '\uD83D\uDD28',
    deploy: '\uD83D\uDE80',
    change: '\uD83D\uDCDD',
    package: '\uD83D\uDCE6',
    rocket: '\uD83D\uDE80',
};

/**
 * Creates a logger with a specific prefix
 * @param prefix - The prefix to show in brackets (e.g., "server", "build")
 * @returns Logger instance with info, success, warn, error, and debug methods
 */
export function createLogger(prefix: LogPrefix): Logger {
    const formatMessage = (message: string, icon?: string): string => {
        const iconPart = icon ? `${icon} ` : '';
        return `[${prefix}] ${iconPart}${message}`;
    };

    return {
        info(message: string): void {
            console.log(formatMessage(message));
        },
        success(message: string): void {
            console.log(formatMessage(message, icons.success));
        },
        warn(message: string): void {
            console.warn(formatMessage(message, icons.warn));
        },
        error(message: string): void {
            console.error(formatMessage(message, icons.error));
        },
        debug(message: string): void {
            console.log(formatMessage(message));
        },
    };
}

/**
 * Formats file size in human-readable format (B, KB, MB)
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit
 */
export function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

/**
 * Logs startup banner for the dev server
 * @param options - URLs for client, Worker/API, and tunnel endpoints
 */
export function logDevServerBanner(options: {
    clientUrl?: string;
    workerUrl?: string;
    tunnelUrl?: string;
}): void {
    console.log('');
    console.log(`${icons.rocket} Bkper App Development Server`);
    console.log('');

    if (options.clientUrl) {
        console.log(`   Open app:    ${options.clientUrl}`);
    }

    if (options.workerUrl) {
        console.log(`   Worker/API:  ${options.workerUrl}`);
    }

    if (options.tunnelUrl) {
        console.log(`   Events:      ${options.tunnelUrl} (tunneled)`);
    }

    if (options.clientUrl) {
        console.log('');
        console.log('   Open the app URL in your browser.');
        console.log('   The Worker/API URL is for /api, /health, /openapi.json, and events.');
    }

    console.log('');
    console.log('   Press Ctrl+C to stop');
    console.log('');
}

/**
 * Logs build results with file sizes
 * @param results - Build output paths and sizes
 */
export function logBuildResults(results: {
    server?: { path: string; size: number };
}): void {
    console.log('');
    console.log(`${icons.package} Building Bkper App...`);
    console.log('');

    if (results.server) {
        console.log(
            `   \u2713 Server worker \u2192 ${results.server.path.padEnd(20)} (${formatSize(
                results.server.size
            )})`
        );
    }

    console.log('');
    console.log(`${icons.success} Build complete`);
    console.log('');
}
