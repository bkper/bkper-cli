import {getOriginRemote, listRemotes, remoteUrlsEqual} from './inspect.js';
import {requireManagedGitPreflight} from './preflight.js';
import {runGit, type GitRunner} from './run-git.js';
import {ManagedGitError, type ManagedSourceUpload} from './types.js';

export interface SafePushOptions {
    appDir?: string;
    expectedOriginRemote?: string;
    requireMainBranch?: boolean;
    upload?: ManagedSourceUpload;
    runner?: GitRunner;
}

export interface SafePushResult {
    branch: string;
    head: string;
    action: 'pushed' | 'already_up_to_date' | 'created_remote_branch';
}

/**
 * Fetches the remote branch and allows only missing, equal, or ancestor remote tips.
 */
export async function assertFastForwardPush(
    repoRoot: string,
    branch: string,
    head: string,
    runner: GitRunner = runGit
): Promise<'missing' | 'same' | 'ahead'> {
    await runner(['fetch', 'origin', branch], {
        cwd: repoRoot,
        allowFailure: true,
    });

    const remoteRef = await runner(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], {
        cwd: repoRoot,
        allowFailure: true,
    });

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

    throw new ManagedGitError(
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

/**
 * Pushes every local branch and tag as one atomic remote update.
 * A rejected ref leaves the managed repository unchanged.
 */
export async function pushAllLocalRefsAtomic(
    options: SafePushOptions = {}
): Promise<SafePushResult> {
    const runner = options.runner ?? runGit;
    const preflight = await requireManagedGitPreflight({
        appDir: options.appDir,
        expectedOriginRemote: options.expectedOriginRemote,
        requireMainBranch: options.requireMainBranch,
        runner,
    });
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
    const preflight = await requireManagedGitPreflight({
        appDir: options.appDir,
        expectedOriginRemote: options.expectedOriginRemote,
        requireMainBranch: options.requireMainBranch,
        runner,
    });

    const remotes = await listRemotes(preflight.repo.root, runner);
    const origin = getOriginRemote(remotes);
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

    const relation = await assertFastForwardPush(
        preflight.repo.root,
        preflight.branch,
        preflight.head,
        runner
    );

    if (relation === 'same') {
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

    if (hasUpstream) {
        await runner(['push', 'origin', `HEAD:${preflight.branch}`], {
            cwd: preflight.repo.root,
        });
    } else {
        await runner(['push', '-u', 'origin', `HEAD:${preflight.branch}`], {
            cwd: preflight.repo.root,
        });
    }

    return {
        branch: preflight.branch,
        head: preflight.head,
        action: relation === 'missing' ? 'created_remote_branch' : 'pushed',
    };
}
