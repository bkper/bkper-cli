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
 * 1. Platform managed record
 * 2. Pending local marker (never downgrade on transient miss)
 * 3. Nested monorepo / external remote / missing git root
 * 4. Existing Core App without pending marker stays external
 * 5. New standalone eligible App activates managed source
 */
export async function detectSourceMode(
    input: DetectSourceModeInput
): Promise<SourceModeDecision> {
    const runner = input.runner ?? runGit;

    if (input.platformStatus?.mode === 'managed') {
        return {
            mode: 'managed',
            reason: 'platform_record',
            appId: input.platformStatus.appId,
        };
    }

    const repo = await inspectGitRepository(input.appDir, runner);
    if (!repo) {
        return {mode: 'external', reason: 'no_git'};
    }

    const marker = readSourceMarker(repo.root);
    if (marker?.state === 'pending') {
        return {
            mode: 'managed',
            reason: 'pending_marker',
            appId: input.appId,
            activationId: marker.activationId,
        };
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

    if (input.coreAppExists) {
        return {mode: 'external', reason: 'existing_core_app'};
    }

    if (input.platformStatus?.mode === 'external') {
        // Eligible new App: local shape already checked.
        return {
            mode: 'activate_managed',
            reason: 'new_standalone_app',
            appId: input.appId,
        };
    }

    // No platform status available and local shape is eligible for activation.
    return {
        mode: 'activate_managed',
        reason: 'new_standalone_app',
        appId: input.appId,
    };
}
