import {AUTHENTICATION_REQUIRED_MESSAGE} from '../../auth/auth-errors.js';
import {
    formatCredentialGetResponse,
    parseCredentialInput,
    requestMatchesRemote,
} from '../apps/git/credentials.js';
import {stripRepositoryTokenSecret} from '../apps/git/platform-source.js';
import {
    ContextForbiddenError,
    createPlatformContextApi,
    isContextScope,
    type ContextScope,
    type PlatformContextApi,
} from './platform-context.js';
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
 * A write credential, so an ordinary push works (and the first one creates the repository); for a Book the person can only
 * view, or their domain when they are not its admin, a read one: Git cannot say whether it fetches or pushes, and a push with
 * it is refused.
 */
async function issue(api: PlatformContextApi, scope: ContextScope) {
    try {
        return await api.issueCredential('write', scope);
    } catch (error) {
        if (scope === USER_CONTEXT_SCOPE || !(error instanceof ContextForbiddenError)) throw error;
        return api.issueCredential('read', scope);
    }
}

/**
 * `bkper context git-credential <scope>`, Git's credential helper for an agent context clone (`user`, `domain`, or
 * `books/<bookId>`). `get` answers with a pull's pre-issued read token when Git runs with it, otherwise a five-minute write
 * token (read, for a Book the person cannot edit or a domain they do not administer). `store` and `erase` do nothing: nothing is ever stored.
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
        const scope = options.scope;
        if (!isContextScope(scope)) {
            writeErr(`Unknown agent context scope '${scope}'.\n`);
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
            const credential = await issue(options.api ?? createPlatformContextApi(), scope);
            if (!('token' in credential)) {
                writeErr('Agent context credential was not issued.\n');
                return 1;
            }
            token = credential.token;
            remote = credential.remote;
        }
        if (!requestMatchesRemote(request, remote)) {
            writeErr(
                scope === USER_CONTEXT_SCOPE || scope === 'domain'
                    ? 'Git credential request does not match your agent context remote. Run: bkper context pull\n'
                    : `Git credential request does not match this Book's agent context remote. Run: bkper context pull -b ${scope.slice('books/'.length)}\n`
            );
            return 1;
        }
        // Credential protocol output only; never log this string.
        writeOut(formatCredentialGetResponse(stripRepositoryTokenSecret(token)));
        return 0;
    } catch (error) {
        const message =
            error instanceof ContextForbiddenError ||
            (error instanceof Error && error.message === AUTHENTICATION_REQUIRED_MESSAGE)
                ? error.message
                : 'Agent context credential helper failed.';
        writeErr(`${message}\n`);
        return 1;
    }
}
