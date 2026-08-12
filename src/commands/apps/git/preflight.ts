import {
    getOriginRemote,
    getWorkingTreeStatus,
    inspectGitRepository,
    remoteUrlsEqual,
    requireGitRepository,
} from './inspect.js';
import {runGit, type GitRunner} from './run-git.js';
import {
    DEFAULT_MANAGED_BRANCH,
    ManagedGitError,
    type GitRepositoryInfo,
    type WorkingTreeStatus,
} from './types.js';

export interface ManagedGitPreflightOptions {
    requireMainBranch?: boolean;
    expectedOriginRemote?: string;
    appDir?: string;
    runner?: GitRunner;
}

export interface ManagedGitPreflightResult {
    repo: GitRepositoryInfo;
    branch: string;
    head: string;
    tree: WorkingTreeStatus;
}

function formatFileList(files: string[], limit = 10): string {
    if (files.length === 0) {
        return '';
    }
    const shown = files.slice(0, limit);
    const remaining = files.length - shown.length;
    const lines = shown.map(file => `  - ${file}`);
    if (remaining > 0) {
        lines.push(`  - ...and ${remaining} more`);
    }
    return lines.join('\n');
}

/**
 * Validates the local Git state required for managed source operations.
 * Never mutates the repository.
 */
export async function requireManagedGitPreflight(
    options: ManagedGitPreflightOptions = {}
): Promise<ManagedGitPreflightResult> {
    const runner = options.runner ?? runGit;
    const appDir = options.appDir ?? process.cwd();
    const repo = await inspectGitRepository(appDir, runner);
    requireGitRepository(repo);

    if (repo.isNestedApp) {
        throw new ManagedGitError(
            'BKPER_YAML_NOT_AT_GIT_ROOT',
            [
                'Managed source requires bkper.yaml at the Git repository root.',
                `Git root: ${repo.root}`,
                `App config: ${repo.bkperYamlPath ?? appDir}`,
                'Nested monorepo Apps keep external source mode and are not migrated automatically.',
            ].join('\n')
        );
    }

    if (!repo.hasCommits || !repo.head) {
        throw new ManagedGitError(
            'NO_COMMITS',
            [
                'Managed source requires a committed HEAD.',
                'Create an initial commit, then retry:',
                '  git add .',
                '  git commit -m "Initial app"',
            ].join('\n')
        );
    }

    if (repo.detached || !repo.branch) {
        throw new ManagedGitError(
            'DETACHED_HEAD',
            [
                'Managed source requires an attached branch (detached HEAD is not allowed).',
                'Create or switch to a branch first, for example:',
                '  git switch -c main',
                'or:',
                '  git switch -c rollback/<name> <commit>',
            ].join('\n')
        );
    }

    if (options.requireMainBranch && repo.branch !== DEFAULT_MANAGED_BRANCH) {
        throw new ManagedGitError(
            'FIRST_ACTIVATION_NOT_MAIN',
            [
                `First managed-source activation requires branch '${DEFAULT_MANAGED_BRANCH}'.`,
                `Current branch: ${repo.branch}`,
                'Switch to main without rewriting history, for example:',
                '  git switch main',
            ].join('\n')
        );
    }

    const tree = await getWorkingTreeStatus(repo.root, runner);
    if (tree.staged.length > 0) {
        throw new ManagedGitError(
            'STAGED_CHANGES',
            [
                'Managed source requires a clean working tree (no staged changes).',
                'Review and commit or unstage these files:',
                formatFileList(tree.staged),
            ].join('\n'),
            tree.staged
        );
    }
    if (tree.modified.length > 0) {
        throw new ManagedGitError(
            'MODIFIED_TRACKED_FILES',
            [
                'Managed source requires a clean working tree (no modified tracked files).',
                'Review and commit or restore these files:',
                formatFileList(tree.modified),
            ].join('\n'),
            tree.modified
        );
    }
    if (tree.untracked.length > 0) {
        throw new ManagedGitError(
            'UNTRACKED_FILES',
            [
                'Managed source requires a clean working tree (no non-ignored untracked files).',
                'Review, commit, or ignore these files:',
                formatFileList(tree.untracked),
            ].join('\n'),
            tree.untracked
        );
    }

    if (options.expectedOriginRemote) {
        requireManagedOrigin(repo, options.expectedOriginRemote);
    }

    return {
        repo,
        branch: repo.branch,
        head: repo.head,
        tree,
    };
}

export function requireManagedOrigin(
    repo: GitRepositoryInfo,
    expectedRemote: string
): void {
    const origin = getOriginRemote(repo.remotes);
    if (!origin) {
        throw new ManagedGitError(
            'MISSING_MANAGED_ORIGIN',
            [
                'Managed source requires the Artifacts repository configured as `origin`.',
                'Repair local Git config with:',
                `  git remote add origin ${expectedRemote}`,
                'Then install the Bkper credential helper and retry.',
            ].join('\n')
        );
    }

    if (!origin.isArtifacts) {
        throw new ManagedGitError(
            'EXTERNAL_ORIGIN_PRESENT',
            [
                'Managed source keeps Artifacts as `origin` and never rewrites an external remote.',
                `Current origin: ${origin.url}`,
                'Rename or remove the external origin yourself only if you intend to use managed source on this clone, for example:',
                '  git remote rename origin upstream',
                `  git remote add origin ${expectedRemote}`,
            ].join('\n')
        );
    }

    if (!remoteUrlsEqual(origin.url, expectedRemote)) {
        throw new ManagedGitError(
            'INCORRECT_MANAGED_ORIGIN',
            [
                'The configured `origin` does not match the Platform-registered Artifacts remote.',
                `Expected: ${expectedRemote}`,
                `Actual:   ${origin.url}`,
                'Repair the origin URL only when you are sure this clone belongs to that managed App.',
            ].join('\n')
        );
    }
}
