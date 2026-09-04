import {getOriginRemote, remoteUrlsEqual} from './inspect.js';
import {
    requireManagedGitPreflight,
    type ManagedGitPreflightResult,
} from './preflight.js';
import {formatGitFailure, runGit, type GitRunner} from './run-git.js';
import {ManagedGitError, type ManagedSourceUpload} from './types.js';

export interface SafePushOptions {
    appDir?: string;
    expectedOriginRemote?: string;
    requireMainBranch?: boolean;
    upload?: ManagedSourceUpload;
    skipPushIfTrackingRefMatches?: boolean;
    preflight?: ManagedGitPreflightResult;
    runner?: GitRunner;
}

export interface SafePushResult {
    branch: string;
    head: string;
    action: 'pushed' | 'already_up_to_date' | 'created_remote_branch';
}

type RemoteRelation = 'missing' | 'same' | 'ahead';

function remoteAheadOrDiverged(branch: string): ManagedGitError {
    return new ManagedGitError(
        'REMOTE_AHEAD_OR_DIVERGED',
        [
            `Remote branch 'origin/${branch}' is ahead of or diverged from local HEAD.`,
            'The CLI never force-pushes, merges, or rebases.',
            'Fetch and reconcile intentionally, then retry:',
            `  git fetch origin ${branch}`,
            '  git log --oneline --left-right HEAD...origin/' + branch,
            '  # merge or rebase by your choice, then:',
            '  git push',
        ].join('\n')
    );
}

async function inspectLocalRemoteRelation(
    repoRoot: string,
    branch: string,
    head: string,
    runner: GitRunner
): Promise<RemoteRelation> {
    const remoteRef = await runner(
        ['rev-parse', '--verify', `refs/remotes/origin/${branch}`],
        {
            cwd: repoRoot,
            allowFailure: true,
        }
    );

    if (remoteRef.exitCode !== 0) {
        return 'missing';
    }

    const remoteSha = remoteRef.stdout.trim();
    if (!remoteSha) {
        return 'missing';
    }
    if (remoteSha === head) {
        return 'same';
    }

    const ancestor = await runner(['merge-base', '--is-ancestor', remoteSha, head], {
        cwd: repoRoot,
        allowFailure: true,
    });
    if (ancestor.exitCode === 0) {
        return 'ahead';
    }

    throw remoteAheadOrDiverged(branch);
}

/**
 * Fetches the remote branch and allows only missing, equal, or ancestor remote tips.
 */
export async function assertFastForwardPush(
    repoRoot: string,
    branch: string,
    head: string,
    runner: GitRunner = runGit
): Promise<RemoteRelation> {
    await runner(['fetch', 'origin', branch], {
        cwd: repoRoot,
        allowFailure: true,
    });
    return inspectLocalRemoteRelation(repoRoot, branch, head, runner);
}

/**
 * Pushes every local branch and tag as one atomic remote update.
 * A rejected ref leaves the managed repository unchanged.
 */
export async function pushAllLocalRefsAtomic(
    options: SafePushOptions = {}
): Promise<SafePushResult> {
    const runner = options.runner ?? runGit;
    const preflight =
        options.preflight ??
        (await requireManagedGitPreflight({
            appDir: options.appDir,
            expectedOriginRemote: options.expectedOriginRemote,
            requireMainBranch: options.requireMainBranch,
            runner,
        }));
    const refsResult = await runner(
        ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/tags'],
        {cwd: preflight.repo.root}
    );
    const refs = refsResult.stdout
        .split(/\r?\n/)
        .map(ref => ref.trim())
        .filter(ref => ref.length > 0);
    const refspecs = refs.map(ref => `${ref}:${ref}`);

    await runner(['push', '--atomic', 'origin', ...refspecs], {
        cwd: preflight.repo.root,
    });
    await runner(
        ['branch', '--set-upstream-to', `origin/${preflight.branch}`, preflight.branch],
        {cwd: preflight.repo.root}
    );

    return {
        branch: preflight.branch,
        head: preflight.head,
        action: 'pushed',
    };
}

/**
 * Safe current-branch push with upstream setup.
 * Never commits, merges, rebases, force-pushes, or discards local changes.
 */
export async function pushCurrentBranchSafe(
    options: SafePushOptions = {}
): Promise<SafePushResult> {
    const runner = options.runner ?? runGit;
    const preflight =
        options.preflight ??
        (await requireManagedGitPreflight({
            appDir: options.appDir,
            expectedOriginRemote: options.expectedOriginRemote,
            requireMainBranch: options.requireMainBranch,
            runner,
        }));

    const origin = getOriginRemote(preflight.repo.remotes);
    if (!origin) {
        throw new ManagedGitError(
            'MISSING_MANAGED_ORIGIN',
            'Managed source requires `origin` before push.'
        );
    }
    if (options.expectedOriginRemote && !remoteUrlsEqual(origin.url, options.expectedOriginRemote)) {
        throw new ManagedGitError(
            'INCORRECT_MANAGED_ORIGIN',
            'origin does not match the expected managed remote.'
        );
    }

    const relation = await inspectLocalRemoteRelation(
        preflight.repo.root,
        preflight.branch,
        preflight.head,
        runner
    );

    if (relation === 'same' && options.skipPushIfTrackingRefMatches) {
        return {
            branch: preflight.branch,
            head: preflight.head,
            action: 'already_up_to_date',
        };
    }

    const upstream = await runner(
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        {
            cwd: preflight.repo.root,
            allowFailure: true,
        }
    );
    const hasUpstream = upstream.exitCode === 0 && upstream.stdout.trim().length > 0;

    const pushArgs = hasUpstream
        ? ['push', 'origin', `HEAD:${preflight.branch}`]
        : ['push', '-u', 'origin', `HEAD:${preflight.branch}`];
    const pushResult = await runner(pushArgs, {
        cwd: preflight.repo.root,
        allowFailure: true,
    });
    if (pushResult.exitCode !== 0) {
        if (/non-fast-forward|fetch first/i.test(`${pushResult.stderr}\n${pushResult.stdout}`)) {
            throw remoteAheadOrDiverged(preflight.branch);
        }
        throw new ManagedGitError(
            'GIT_COMMAND_FAILED',
            formatGitFailure(pushArgs, pushResult)
        );
    }

    return {
        branch: preflight.branch,
        head: preflight.head,
        action: relation === 'missing' ? 'created_remote_branch' : 'pushed',
    };
}
