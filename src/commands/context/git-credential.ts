import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../auth/auth-errors.js';
import {
    formatCredentialGetResponse,
    parseCredentialInput,
    requestMatchesRemote,
} from '../apps/git/credentials.js';
import {stripRepositoryTokenSecret} from '../apps/git/platform-source.js';
import {createPlatformContextApi, type PlatformContextApi} from './platform-context.js';
import {USER_CONTEXT_SCOPE} from './user-context.js';

export interface ContextCredentialHelperOptions {
    scope: string;
    operation?: string;
    stdin?: string;
    api?: PlatformContextApi;
    environment?: NodeJS.ProcessEnv;
    stdout?: (chunk: string) => void;
    stderr?: (chunk: string) => void;
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

/**
 * `bkper context git-credential <scope>`, Git's credential helper for an agent context clone. `get` answers with the
 * background pull's pre-issued read token when Git runs with it, otherwise a five-minute write token, so an ordinary push
 * works (and the first one creates the repository). `store` and `erase` do nothing: nothing is ever stored.
 */
export async function runContextCredentialHelper(options: ContextCredentialHelperOptions): Promise<number> {
    const operation = options.operation ?? 'get';
    const writeOut = options.stdout ?? (chunk => process.stdout.write(chunk));
    const writeErr = options.stderr ?? (chunk => process.stderr.write(chunk));
    if (operation === 'store' || operation === 'erase') return 0;
    if (operation !== 'get') {
        writeErr(`Unsupported credential operation '${operation}'. Expected get, store, or erase.\n`);
        return 1;
    }
    try {
        if (options.scope !== USER_CONTEXT_SCOPE) {
            writeErr(`Unknown agent context scope '${options.scope}'.\n`);
            return 1;
        }
        const request = parseCredentialInput(options.stdin ?? (await readStdin()));
        if (request.protocol !== 'https' || !request.host) {
            writeErr('Agent context credentials only support https.\n');
            return 1;
        }
        const environment = options.environment ?? process.env;
        let token = environment.BKPER_CONTEXT_TOKEN;
        let remote = environment.BKPER_CONTEXT_REMOTE;
        if (!token || !remote) {
            const credential = await (options.api ?? createPlatformContextApi()).issueCredential('write');
            if (!('token' in credential)) {
                writeErr('Agent context credential was not issued.\n');
                return 1;
            }
            token = credential.token;
            remote = credential.remote;
        }
        if (!requestMatchesRemote(request, remote)) {
            writeErr('Git credential request does not match your agent context remote. Run: bkper context pull\n');
            return 1;
        }
        // Credential protocol output only; never log this string.
        writeOut(formatCredentialGetResponse(stripRepositoryTokenSecret(token)));
        return 0;
    } catch (error) {
        const message = error instanceof Error && error.message === AUTHENTICATION_REQUIRED_MESSAGE
            ? AUTHENTICATION_REQUIRED_MESSAGE
            : 'Agent context credential helper failed.';
        writeErr(`${message}\n`);
        return 1;
    }
}
