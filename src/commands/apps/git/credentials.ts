import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../../auth/auth-errors.js';
import {runGit, type GitRunner} from './run-git.js';
import {
    createPlatformSourceApi,
    stripRepositoryTokenSecret,
    type PlatformSourceApi,
} from './platform-source.js';
import {
    CREDENTIAL_USERNAME,
    ManagedGitError,
    type ManagedSourceCredential,
} from './types.js';
import {isArtifactsRemoteUrl, normalizeRemoteUrl} from './inspect.js';

export interface CredentialRequest {
    protocol?: string;
    host?: string;
    path?: string;
    username?: string;
}

export interface CredentialHelperOptions {
    appId?: string;
    stdin?: string;
    operation?: string;
    api?: PlatformSourceApi;
    environment?: NodeJS.ProcessEnv;
    stdout?: (chunk: string) => void;
    stderr?: (chunk: string) => void;
}

/**
 * Parses Git's credential helper stdin protocol.
 */
export function parseCredentialInput(input: string): CredentialRequest {
    const request: CredentialRequest = {};
    for (const rawLine of input.split(/\r?\n/)) {
        const line = rawLine.trimEnd();
        if (!line) {
            continue;
        }
        const eq = line.indexOf('=');
        if (eq <= 0) {
            continue;
        }
        const key = line.slice(0, eq);
        const value = line.slice(eq + 1);
        if (key === 'protocol' || key === 'host' || key === 'path' || key === 'username') {
            request[key] = value;
        }
    }
    return request;
}

export function buildCredentialHelperCommand(appId: string): string {
    // Git appends get|store|erase to this exact shell helper command.
    return `!bkper app git-credential ${shellSingleQuote(appId)}`;
}

function shellSingleQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildCredentialConfigSection(remote: string, appId: string): string {
    return [
        `[credential ${JSON.stringify(normalizeRemoteUrl(remote))}]`,
        '    useHttpPath = true',
        '    helper =',
        `    helper = ${buildCredentialHelperCommand(appId)}`,
        '',
    ].join('\n');
}

/**
 * Configures exact URL/path-scoped credentials for the managed remote.
 * Clears inherited helpers for that credential context and pins the App ID.
 */
export async function configureManagedCredentialHelper(
    repoRoot: string,
    remote: string,
    appId: string,
    runner: GitRunner = runGit
): Promise<void> {
    if (!isArtifactsRemoteUrl(remote)) {
        throw new ManagedGitError(
            'INVALID_CREDENTIAL_REQUEST',
            'Managed credentials can only be configured for an Artifacts HTTPS remote.'
        );
    }

    const remoteKey = normalizeRemoteUrl(remote);
    await runner(['config', `credential.${remoteKey}.useHttpPath`, 'true'], {cwd: repoRoot});
    // Replace all local values with the empty helper so retries remain idempotent
    // while clearing inherited persistent helpers for this credential context.
    await runner(['config', '--replace-all', `credential.${remoteKey}.helper`, ''], {
        cwd: repoRoot,
    });
    await runner(
        ['config', '--add', `credential.${remoteKey}.helper`, buildCredentialHelperCommand(appId)],
        {cwd: repoRoot}
    );
}

function requestMatchesRemote(request: CredentialRequest, remote: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(remote);
    } catch {
        return false;
    }

    if (request.protocol && request.protocol !== parsed.protocol.replace(/:$/, '')) {
        return false;
    }
    if (request.host && request.host !== parsed.host) {
        return false;
    }
    if (request.path) {
        const expectedPath = parsed.pathname.replace(/^\//, '');
        const actualPath = request.path.replace(/^\//, '');
        if (actualPath !== expectedPath) {
            return false;
        }
    }
    return true;
}

export function formatCredentialGetResponse(password: string): string {
    return `username=${CREDENTIAL_USERNAME}\npassword=${password}\n`;
}

/**
 * Implements `bkper app git-credential <appId>` for Git's credential helper protocol.
 * - get: uses the clone's pre-issued read token or issues a short-lived write token
 * - store/erase: no-op (never persists)
 */
export async function runGitCredentialHelper(
    options: CredentialHelperOptions = {}
): Promise<number> {
    const operation = options.operation ?? process.argv[2] ?? 'get';
    const writeOut = options.stdout ?? (chunk => process.stdout.write(chunk));
    // stderr is available for hard failures only; never print tokens.
    const writeErr = options.stderr ?? (chunk => process.stderr.write(chunk));

    if (operation === 'store' || operation === 'erase') {
        return 0;
    }
    if (operation !== 'get') {
        writeErr(
            `Unsupported credential operation '${operation}'. Expected get, store, or erase.\n`
        );
        return 1;
    }

    try {
        const appId = options.appId;
        if (!appId) {
            throw new ManagedGitError(
                'INVALID_CREDENTIAL_REQUEST',
                'The managed Git credential helper requires a pinned App ID.'
            );
        }

        const stdin = options.stdin ?? (await readStdin());
        const request = parseCredentialInput(stdin);
        if (!request.protocol || !request.host) {
            throw new ManagedGitError(
                'INVALID_CREDENTIAL_REQUEST',
                'Git credential request is missing protocol or host.'
            );
        }
        if (request.protocol !== 'https') {
            throw new ManagedGitError(
                'INVALID_CREDENTIAL_REQUEST',
                'Managed source credentials only support https.'
            );
        }

        const environment = options.environment ?? process.env;
        const cloneToken = environment.BKPER_CLONE_TOKEN;
        const cloneRemote = environment.BKPER_CLONE_REMOTE;
        let token: string;
        let remote: string;

        if (cloneToken || cloneRemote) {
            if (!cloneToken || !cloneRemote) {
                throw new ManagedGitError(
                    'INVALID_CREDENTIAL_REQUEST',
                    'Managed clone credential environment is incomplete.'
                );
            }
            token = cloneToken;
            remote = cloneRemote;
        } else {
            const api = options.api ?? createPlatformSourceApi();
            let credential: ManagedSourceCredential;
            try {
                credential = await api.issueCredential(appId, 'write');
            } catch (error) {
                if (error instanceof ManagedGitError) {
                    throw error;
                }
                throw new ManagedGitError(
                    'MANAGED_SOURCE_UNAVAILABLE',
                    'Failed to issue managed source credentials. Run: bkper auth login'
                );
            }
            token = credential.token;
            remote = credential.remote;
        }

        if (!requestMatchesRemote(request, remote)) {
            throw new ManagedGitError(
                'INVALID_CREDENTIAL_REQUEST',
                [
                    'Git credential request does not match the Platform-registered Artifacts remote.',
                    'Repair managed origin configuration, then retry the Git operation.',
                ].join('\n')
            );
        }

        const password = stripRepositoryTokenSecret(token);
        // Credential protocol output only — never log this string.
        writeOut(formatCredentialGetResponse(password));
        return 0;
    } catch (error) {
        if (error instanceof ManagedGitError) {
            if (error.code === 'AUTHENTICATION_REQUIRED') {
                writeErr(`${AUTHENTICATION_REQUIRED_MESSAGE}\n`);
            } else {
                writeErr(`${error.message}\n`);
            }
            return 1;
        }
        writeErr('Managed source credential helper failed.\n');
        return 1;
    }
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}
