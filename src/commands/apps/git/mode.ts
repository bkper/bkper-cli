import path from 'path';
import {hasExternalRemote, inspectGitRepository} from './inspect.js';
import {readSourceMarker} from './markers.js';
import {runGit, type GitRunner} from './run-git.js';
import type {
    ManagedSourcePlatformStatus,
    SourceModeDecision,
} from './types.js';

export interface DetectSourceModeInput {
    appDir: string;
    appId: string;
    /** Platform managed-source status when available. Null means not fetched. */
    platformStatus: ManagedSourcePlatformStatus | null;
    /** True when Core already has this App id. */
    coreAppExists: boolean;
    /** True when Platform reports managed-source feature disabled. */
    featureDisabled?: boolean;
    runner?: GitRunner;
}

/**
 * Deterministic source-mode detection.
 *
 * Order:
 * 1. Pending local marker (preserves activation upload scope across retries)
 * 2. Platform managed record
 * 3. Nested monorepo / external remote / missing git root
 * 4. Eligible standalone Apps activate managed source
 */
export async function detectSourceMode(
    input: DetectSourceModeInput
): Promise<SourceModeDecision> {
    const runner = input.runner ?? runGit;

    const repo = await inspectGitRepository(input.appDir, runner);
    const marker = repo ? readSourceMarker(repo.root) : null;
    if (marker?.state === 'pending') {
        return {
            mode: 'managed',
            reason: 'pending_marker',
            appId: input.appId,
            activationId: marker.activationId,
            upload: marker.upload,
        };
    }

    if (input.platformStatus?.mode === 'managed') {
        return {
            mode: 'managed',
            reason: 'platform_record',
            appId: input.platformStatus.appId,
        };
    }

    if (!repo) {
        return {mode: 'external', reason: 'no_git'};
    }

    if (marker?.state === 'managed') {
        return {
            mode: 'managed',
            reason: 'platform_record',
            appId: marker.appId,
            remote: marker.remote,
        };
    }

    if (input.featureDisabled) {
        return {mode: 'external', reason: 'feature_disabled'};
    }

    if (repo.isNestedApp) {
        return {
            mode: 'external',
            reason: 'nested_app',
            details: repo.bkperYamlPath ?? undefined,
        };
    }

    const bkperDir = repo.bkperYamlPath
        ? path.dirname(path.resolve(repo.bkperYamlPath))
        : path.resolve(input.appDir);
    if (bkperDir !== repo.root) {
        return {
            mode: 'external',
            reason: 'not_git_root',
            details: repo.root,
        };
    }

    if (hasExternalRemote(repo.remotes)) {
        const external = repo.remotes
            .filter(remote => !remote.isArtifacts)
            .map(remote => `${remote.name}=${remote.url}`)
            .join(', ');
        return {
            mode: 'external',
            reason: 'external_remote',
            details: external,
        };
    }

    return input.coreAppExists
        ? {
              mode: 'activate_managed',
              reason: 'existing_standalone_app',
              appId: input.appId,
              upload: 'all_refs',
          }
        : {
              mode: 'activate_managed',
              reason: 'new_standalone_app',
              appId: input.appId,
              upload: 'main',
          };
}
