import {
    getOriginRemote,
    isArtifactsRemoteUrl,
    listRemotes,
    remoteUrlsEqual,
} from './inspect.js';
import {configureManagedCredentialHelper} from './credentials.js';
import {runGit, type GitRunner} from './run-git.js';
import {ManagedGitError} from './types.js';

/**
 * Configures Artifacts as `origin` only after managed activation.
 * Never modifies an existing external remote.
 */
export async function configureManagedOrigin(
    repoRoot: string,
    remote: string,
    appId: string,
    runner: GitRunner = runGit
): Promise<void> {
    if (!isArtifactsRemoteUrl(remote)) {
        throw new ManagedGitError(
            'INVALID_CREDENTIAL_REQUEST',
            'Managed origin must be an Artifacts HTTPS remote.'
        );
    }

    const remotes = await listRemotes(repoRoot, runner);
    const origin = getOriginRemote(remotes);

    if (!origin) {
        await runner(['remote', 'add', 'origin', remote], {cwd: repoRoot});
    } else if (!origin.isArtifacts) {
        throw new ManagedGitError(
            'EXTERNAL_ORIGIN_PRESENT',
            [
                'Refusing to rewrite an external `origin` remote.',
                `Current origin: ${origin.url}`,
                'Rename the external remote yourself if this clone should use managed source:',
                '  git remote rename origin upstream',
                `  git remote add origin ${remote}`,
            ].join('\n')
        );
    } else if (!remoteUrlsEqual(origin.url, remote)) {
        throw new ManagedGitError(
            'INCORRECT_MANAGED_ORIGIN',
            [
                'An Artifacts `origin` already exists but does not match the registered remote.',
                `Expected: ${remote}`,
                `Actual:   ${origin.url}`,
                'Resolve the mismatch manually. The CLI never rewrites remotes automatically.',
            ].join('\n')
        );
    }

    await configureManagedCredentialHelper(repoRoot, remote, appId, runner);
}
