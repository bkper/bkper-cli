import { Command, program } from 'commander';
import { getStoredOAuthToken } from '../../auth/local-auth-service.js';
import { createPlatformClient } from '../../platform/client.js';
import { handleError, loadAppConfig } from './config.js';
import type {
    Environment,
    HandlerType,
    LogsOptions,
    LogsOutputMode,
    LogsResponse,
} from './types.js';

interface LogsPlatformClient {
    GET(
        path: '/api/apps/{appId}/logs',
        init: {
            params: {
                path: { appId: string };
                query: ReturnType<typeof buildLogsQuery>;
            };
        }
    ): Promise<{ data?: LogsResponse; error?: unknown }>;
}

interface LogsCommandDependencies {
    loadAppConfig: typeof loadAppConfig;
    getStoredOAuthToken: typeof getStoredOAuthToken;
    createPlatformClient(token?: string): LogsPlatformClient;
    handleError: typeof handleError;
    exit(code?: number): never;
}

function getLogsDependencies(
    overrides: Partial<LogsCommandDependencies> = {}
): LogsCommandDependencies {
    return {
        loadAppConfig,
        getStoredOAuthToken,
        createPlatformClient,
        handleError,
        exit(code?: number): never {
            process.exit(code);
        },
        ...overrides,
    };
}

export function resolveLogsHandler(options: Pick<LogsOptions, 'web' | 'events'>): HandlerType | undefined {
    if ((options.web && options.events) || (!options.web && !options.events)) {
        return undefined;
    }

    return options.events ? 'events' : 'web';
}

export function buildLogsQuery(options: LogsOptions): {
    since?: string;
    until?: string;
    last: number;
    env: Environment;
    handler?: HandlerType;
    outcome?: LogsOptions['outcome'];
    statusCode?: number;
} {
    const handler = resolveLogsHandler(options);

    return {
        env: options.preview ? 'preview' : 'production',
        last: options.last ?? 100,
        ...(handler ? { handler } : {}),
        ...(options.since ? { since: options.since } : {}),
        ...(options.until ? { until: options.until } : {}),
        ...(options.outcome ? { outcome: options.outcome } : {}),
        ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
    };
}

export function resolveLogsOutputMode(command: Pick<Command, 'optsWithGlobals' | 'getOptionValueSourceWithGlobals'>): LogsOutputMode {
    const options = command.optsWithGlobals() as { format?: string; json?: boolean };

    if (options.json || options.format === 'json') {
        return 'json';
    }

    const formatSource = command.getOptionValueSourceWithGlobals('format');
    if (formatSource === 'cli') {
        throw new Error(
            'bkper app logs only supports default human-readable output or JSON. Use --json or --format json.'
        );
    }

    return 'pretty';
}

export function renderLogsResponse(response: LogsResponse, mode: LogsOutputMode): string {
    if (mode === 'json') {
        return JSON.stringify(response, null, 2);
    }

    const lines: string[] = [];

    for (const warning of response.meta.warnings) {
        lines.push(`Warning: ${warning}`);
    }

    if (response.logs.length === 0) {
        if (lines.length > 0) {
            lines.push('');
        }
        lines.push('No logs found.');
        return lines.join('\n');
    }

    if (lines.length > 0) {
        lines.push('');
    }

    const orderedLogs = [...response.logs].reverse();
    orderedLogs.forEach((entry, index) => {
        lines.push(
            `${entry.timestamp} ${entry.environment}/${entry.handler} ${entry.outcome} ${entry.requestMethod ?? '-'} ${entry.statusCode ?? '-'} ${entry.requestUrl ?? ''}`.trim()
        );

        for (const logLine of entry.logs) {
            lines.push(`  log: ${logLine}`);
        }

        for (const exception of entry.exceptions) {
            lines.push(`  exception: ${exception.name}: ${exception.message}`);
            if (exception.stack) {
                for (const stackLine of exception.stack.split('\n')) {
                    lines.push(`    ${stackLine}`);
                }
            }
        }

        if (index < orderedLogs.length - 1) {
            lines.push('');
        }
    });

    return lines.join('\n');
}

export async function requestAppLogs(
    options: LogsOptions = {},
    overrides: Partial<LogsCommandDependencies> = {}
): Promise<LogsResponse> {
    const dependencies = getLogsDependencies(overrides);

    let config: bkper.App;
    try {
        config = dependencies.loadAppConfig();
    } catch {
        console.error('Error: bkper.yaml or bkper.json not found');
        return dependencies.exit(1);
    }

    if (!config?.id) {
        console.error('Error: App config is missing "id" field');
        return dependencies.exit(1);
    }

    const token = await dependencies.getStoredOAuthToken();
    const client = dependencies.createPlatformClient(token);

    const { data, error } = await client.GET('/api/apps/{appId}/logs', {
        params: {
            path: { appId: config.id },
            query: buildLogsQuery(options),
        },
    });

    if (error) {
        dependencies.handleError(error);
    }

    if (!data) {
        console.error('Error: Unexpected empty response');
        return dependencies.exit(1);
    }

    return data;
}

export async function logsApp(
    options: LogsOptions = {},
    overrides: Partial<LogsCommandDependencies> = {},
    command: Pick<Command, 'optsWithGlobals' | 'getOptionValueSourceWithGlobals'> = program
): Promise<void> {
    const outputMode = resolveLogsOutputMode(command);
    const response = await requestAppLogs(options, overrides);
    console.log(renderLogsResponse(response, outputMode));
}
