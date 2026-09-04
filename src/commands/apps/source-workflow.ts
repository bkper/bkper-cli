import {
    configureManagedOrigin,
    createPlatformSourceApi,
    detectSourceMode,
    ensurePendingSourceMarker,
    hasExternalRemote,
    inspectGitRepository,
    ManagedGitError,
    pushAllLocalRefsAtomic,
    pushCurrentBranchSafe,
    readSourceMarker,
    requireGitRepository,
    requireManagedGitPreflight,
    writeManagedSourceMarker,
    type ManagedSourcePlatformStatus,
    type PlatformSourceApi,
    type SafePushOptions,
    type SafePushResult,
} from './git/index.js';
import {
    prepareExternalSource,
    type ExternalSourceVerification,
    type PrepareExternalSourceOptions,
} from './git/external-source.js';
import type {SyncResult} from './types.js';

export interface DeploySourceMetadata {
    mode: 'managed';
    declaredBranch: string;
    commitSha: string;
}

type PrepareExternalSource = (
    options?: PrepareExternalSourceOptions
) => Promise<ExternalSourceVerification>;

type ConfigureOrigin = typeof configureManagedOrigin;
type PushManagedSource = (options: SafePushOptions) => Promise<SafePushResult>;

interface SourceWorkflowOptions {
    appId: string;
    appDir?: string;
    api?: PlatformSourceApi;
    configureOrigin?: ConfigureOrigin;
    push?: PushManagedSource;
    prepareExternal?: PrepareExternalSource;
}

export interface ManagedSyncWorkflowOptions extends SourceWorkflowOptions {
    coreAppExists: boolean;
    syncCore(action: SyncResult['action']): Promise<void>;
}

function platformStatus(
    status: ManagedSourcePlatformStatus | 'feature_disabled' | 'app_not_found'
): ManagedSourcePlatformStatus | null {
    return typeof status === 'string' ? null : status;
}

async function pushManagedRepository(
    options: SourceWorkflowOptions,
    remote: string,
    requireMainBranch = false,
    upload: SafePushOptions['upload'] = 'main',
    skipPushIfTrackingRefMatches = false
): Promise<SafePushResult> {
    const appDir = options.appDir ?? process.cwd();
    if (options.push) {
        return options.push({
            appDir,
            expectedOriginRemote: remote,
            requireMainBranch,
            upload,
            skipPushIfTrackingRefMatches,
        });
    }

    const preflight = await requireManagedGitPreflight({
        appDir,
        expectedOriginRemote: remote,
        requireMainBranch,
    });
    await (options.configureOrigin ?? configureManagedOrigin)(
        preflight.repo.root,
        remote,
        options.appId
    );
    const push = upload === 'all_refs' ? pushAllLocalRefsAtomic : pushCurrentBranchSafe;
    return push({
        appDir,
        expectedOriginRemote: remote,
        requireMainBranch,
        upload,
        skipPushIfTrackingRefMatches,
        preflight,
    });
}

async function validateLocalManagedMarker(appDir: string, appId: string): Promise<void> {
    const repo = await inspectGitRepository(appDir);
    if (!repo) return;
    const marker = readSourceMarker(repo.root);
    if (marker?.state === 'managed' && marker.appId !== appId) {
        throw new ManagedGitError(
            'APP_ID_MISMATCH',
            [
                'The local managed-source marker does not match bkper.yaml.',
                `Config App ID: ${appId}`,
                `Marker App ID: ${marker.appId}`,
                'Use the clone that belongs to this App or repair the local marker intentionally.',
            ].join('\n')
        );
    }
}

/**
 * Integrates managed activation and source pushes into direct Core metadata sync.
 * Core remains the metadata authority; Artifacts pushes never deploy.
 */
export async function syncManagedAppSource(
    options: ManagedSyncWorkflowOptions
): Promise<SyncResult> {
    const appDir = options.appDir ?? process.cwd();
    const repo = await inspectGitRepository(appDir);
    requireGitRepository(repo);
    const api = options.api ?? createPlatformSourceApi();
    const statusResult = await api.getStatus(options.appId);
    const status = platformStatus(statusResult);
    const decision = await detectSourceMode({
        appDir,
        appId: options.appId,
        platformStatus: status,
        coreAppExists: options.coreAppExists,
        featureDisabled: statusResult === 'feature_disabled',
    });
    const action: SyncResult['action'] = options.coreAppExists ? 'updated' : 'created';

    if (decision.mode === 'external') {
        await (options.prepareExternal ?? prepareExternalSource)({appDir});
        await options.syncCore(action);
        return {id: options.appId, action};
    }

    await validateLocalManagedMarker(appDir, options.appId);

    if (statusResult === 'feature_disabled') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'This repository has a managed-source marker, but managed source is disabled. Retry when the Platform feature is available.'
        );
    }

    if (decision.mode === 'activate_managed' || decision.reason === 'pending_marker') {
        const preflight = await requireManagedGitPreflight({
            appDir,
            requireMainBranch: true,
        });
        const upload = decision.upload ?? 'main';
        const pending = ensurePendingSourceMarker(preflight.repo.root, upload);
        console.log(
            upload === 'all_refs'
                ? 'Enabling Bkper-managed source and uploading local branches and tags...'
                : 'Enabling Bkper-managed source and uploading committed main...'
        );

        await options.syncCore(action);
        const activation = await api.activate(options.appId, pending.activationId);
        if (activation.source.appId !== options.appId) {
            throw new ManagedGitError(
                'APP_ID_MISMATCH',
                'Managed source activation returned a different App ID.'
            );
        }
        await (options.configureOrigin ?? configureManagedOrigin)(
            preflight.repo.root,
            activation.source.remote,
            options.appId
        );
        await pushManagedRepository(
            options,
            activation.source.remote,
            true,
            pending.upload
        );
        writeManagedSourceMarker(
            preflight.repo.root,
            options.appId,
            activation.source.remote
        );
        return {id: options.appId, action};
    }

    if (status?.mode !== 'managed') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'The local repository is managed, but the Platform record is not visible yet. Retry the sync.'
        );
    }
    if (status.appId !== options.appId) {
        throw new ManagedGitError(
            'APP_ID_MISMATCH',
            'Platform managed source does not match the local App ID.'
        );
    }

    await pushManagedRepository(options, status.remote);
    const refreshedRepo = await inspectGitRepository(appDir);
    if (refreshedRepo) {
        writeManagedSourceMarker(refreshedRepo.root, options.appId, status.remote);
    }
    await options.syncCore(action);
    return {id: options.appId, action};
}

/**
 * Pushes managed source before the caller reads and uploads existing local build output.
 * External Apps are verified by the CLI and retain source-less Platform uploads.
 */
export async function prepareManagedDeploySource(
    options: SourceWorkflowOptions
): Promise<DeploySourceMetadata | undefined> {
    const appDir = options.appDir ?? process.cwd();
    const repo = await inspectGitRepository(appDir);
    requireGitRepository(repo);
    const prepareExternal = options.prepareExternal ?? prepareExternalSource;
    const api = options.api ?? createPlatformSourceApi();
    let statusResult: Awaited<ReturnType<PlatformSourceApi['getStatus']>>;
    try {
        statusResult = await api.getStatus(options.appId);
    } catch (error) {
        if (error instanceof ManagedGitError && error.code === 'AUTHENTICATION_REQUIRED') {
            const marker = readSourceMarker(repo.root);
            if (!marker && (repo.isNestedApp || hasExternalRemote(repo.remotes))) {
                await prepareExternal({appDir});
                return undefined;
            }
        }
        throw error;
    }
    if (statusResult === 'feature_disabled' || statusResult === 'app_not_found') {
        const marker = readSourceMarker(repo.root);
        if (marker) {
            throw new ManagedGitError(
                'MANAGED_SOURCE_UNAVAILABLE',
                statusResult === 'feature_disabled'
                    ? 'This repository is managed, but managed source is disabled in this Platform environment.'
                    : 'This repository is managed, but its Platform linkage is not visible. Retry the deployment.'
            );
        }
        if (repo.isNestedApp || hasExternalRemote(repo.remotes)) {
            await prepareExternal({appDir});
            return undefined;
        }
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            [
                'This standalone App has no stored source linked for deployment.',
                'Run `bkper app sync` to create and upload Bkper-managed private source, then retry.',
            ].join('\n')
        );
    }

    const decision = await detectSourceMode({
        appDir,
        appId: options.appId,
        platformStatus: statusResult,
        coreAppExists: true,
    });
    if (decision.mode === 'external') {
        await prepareExternal({appDir});
        return undefined;
    }
    if (decision.mode === 'activate_managed') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            [
                'This standalone App has not enabled Bkper-managed source yet.',
                'Run `bkper app sync` to create and upload the private repository, then retry deployment.',
            ].join('\n')
        );
    }
    if (decision.reason === 'pending_marker') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'Managed source activation is pending. Run `bkper app sync` to finish uploading source before deploying.'
        );
    }

    await validateLocalManagedMarker(appDir, options.appId);
    if (statusResult.mode !== 'managed') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'Managed source linkage is not visible yet. Run `bkper app sync` or retry the deployment.'
        );
    }
    if (statusResult.appId !== options.appId) {
        throw new ManagedGitError(
            'APP_ID_MISMATCH',
            'Platform managed source does not match the local App ID.'
        );
    }

    const pushed = await pushManagedRepository(
        options,
        statusResult.remote,
        false,
        'main',
        true
    );
    const refreshedRepo = await inspectGitRepository(appDir);
    if (refreshedRepo) {
        writeManagedSourceMarker(refreshedRepo.root, options.appId, statusResult.remote);
    }
    return {
        mode: 'managed',
        declaredBranch: pushed.branch,
        commitSha: pushed.head,
    };
}
