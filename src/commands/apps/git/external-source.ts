import {requireGitSourcePreflight} from './preflight.js';
import {runGit, type GitRunner} from './run-git.js';
import {ManagedGitError} from './types.js';

export interface ExternalSourceVerification {
    branch: string;
    commitSha: string;
    remote: string;
}

export interface PrepareExternalSourceOptions {
    appDir?: string;
    runner?: GitRunner;
}

function isNetworkRepository(url: string): boolean {
    if (/^[^/@\s]+@[^:\s]+:.+$/.test(url)) {
        return true;
    }
    try {
        const parsed = new URL(url);
        return ['https:', 'ssh:', 'git:'].includes(parsed.protocol) && !!parsed.hostname;
    } catch {
        return false;
    }
}

function sourcePushGuidance(remote: string, branch: string): string {
    return `git push --set-upstream ${remote} ${branch}`;
}

/**
 * Verifies that an external upstream contains the current clean commit.
 * It fetches source but never pushes or changes the working tree.
 */
export async function prepareExternalSource(
    options: PrepareExternalSourceOptions = {}
): Promise<ExternalSourceVerification> {
    const runner = options.runner ?? runGit;
    const preflight = await requireGitSourcePreflight({
        appDir: options.appDir,
        allowNestedApp: true,
        sourceLabel: 'External source storage',
        runner,
    });

    const remoteResult = await runner(
        ['config', '--get', `branch.${preflight.branch}.remote`],
        {cwd: preflight.repo.root, allowFailure: true}
    );
    const mergeResult = await runner(
        ['config', '--get', `branch.${preflight.branch}.merge`],
        {cwd: preflight.repo.root, allowFailure: true}
    );
    const remoteName = remoteResult.stdout.trim();
    const mergeRef = mergeResult.stdout.trim();

    if (
        remoteResult.exitCode !== 0 ||
        mergeResult.exitCode !== 0 ||
        !remoteName ||
        remoteName === '.' ||
        !mergeRef.startsWith('refs/heads/')
    ) {
        throw new ManagedGitError(
            'MISSING_SOURCE_UPSTREAM',
            [
                `Branch '${preflight.branch}' has no external upstream source.`,
                'Choose the intended remote and store the branch before retrying:',
                `  ${sourcePushGuidance('<remote>', preflight.branch)}`,
                'The CLI never chooses or pushes an external remote automatically.',
            ].join('\n')
        );
    }

    const remote = preflight.repo.remotes.find(candidate => candidate.name === remoteName);
    if (!remote || remote.isArtifacts) {
        throw new ManagedGitError(
            'MISSING_SOURCE_UPSTREAM',
            [
                `Branch '${preflight.branch}' does not track an external Git remote.`,
                'Choose and push the intended external source before retrying.',
                `  ${sourcePushGuidance('<remote>', preflight.branch)}`,
            ].join('\n')
        );
    }
    if (!isNetworkRepository(remote.url)) {
        throw new ManagedGitError(
            'SOURCE_REMOTE_NOT_DURABLE',
            [
                `The upstream '${remoteName}' is a local filesystem repository.`,
                'Deployment requires durable network source storage.',
                'Configure and push a network Git upstream, then retry.',
                'For a standalone App, you can instead remove every local-only remote and run `bkper app sync` to use Bkper-managed private source.',
            ].join('\n')
        );
    }

    const remoteBranch = mergeRef.slice('refs/heads/'.length);
    const fetched = await runner(['fetch', '--no-tags', remoteName, mergeRef], {
        cwd: preflight.repo.root,
        allowFailure: true,
    });
    if (fetched.exitCode !== 0) {
        throw new ManagedGitError(
            'SOURCE_REMOTE_UNAVAILABLE',
            [
                `Could not fetch external source from '${remoteName}'.`,
                'Check network access and Git credentials, then retry.',
            ].join('\n')
        );
    }

    const remoteHeadResult = await runner(['rev-parse', '--verify', 'FETCH_HEAD'], {
        cwd: preflight.repo.root,
        allowFailure: true,
    });
    const remoteHead = remoteHeadResult.stdout.trim();
    if (remoteHeadResult.exitCode !== 0 || !remoteHead) {
        throw new ManagedGitError(
            'SOURCE_COMMIT_NOT_PUSHED',
            [
                `Upstream branch '${remoteName}/${remoteBranch}' does not exist.`,
                'Store the current branch before retrying:',
                `  ${sourcePushGuidance(remoteName, preflight.branch)}`,
            ].join('\n')
        );
    }

    const containsHead = await runner(
        ['merge-base', '--is-ancestor', preflight.head, remoteHead],
        {cwd: preflight.repo.root, allowFailure: true}
    );
    if (containsHead.exitCode !== 0) {
        throw new ManagedGitError(
            'SOURCE_COMMIT_NOT_PUSHED',
            [
                `Commit ${preflight.head} is not stored by upstream branch '${remoteName}/${remoteBranch}'.`,
                'Push the current branch before retrying:',
                `  ${sourcePushGuidance(remoteName, preflight.branch)}`,
                'The CLI never pushes external source automatically.',
            ].join('\n')
        );
    }

    return {
        branch: preflight.branch,
        commitSha: preflight.head,
        remote: remoteName,
    };
}
