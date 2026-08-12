export {
    ARTIFACTS_HOST_SUFFIX,
    CREDENTIAL_USERNAME,
    DEFAULT_MANAGED_BRANCH,
    ManagedGitError,
    SOURCE_MARKER_DIR,
    SOURCE_MARKER_FILE,
    type GitPreflightCode,
    type GitRemote,
    type GitRepositoryInfo,
    type ManagedSourceActivationResult,
    type ManagedSourceCredential,
    type ManagedSourcePlatformStatus,
    type SourceMarker,
    type SourceMode,
    type SourceModeDecision,
    type WorkingTreeStatus,
} from './types.js';

export {runGit, type GitCommandResult, type GitRunOptions, type GitRunner} from './run-git.js';

export {
    ensureGitInitialized,
    findBkperYaml,
    findGitRoot,
    getCurrentBranch,
    getHeadSha,
    getOriginRemote,
    getWorkingTreeStatus,
    hasExternalRemote,
    inspectGitRepository,
    isArtifactsRemoteUrl,
    listRemotes,
    normalizeRemoteUrl,
    remoteUrlsEqual,
    requireGitRepository,
} from './inspect.js';

export {
    createActivationId,
    ensurePendingSourceMarker,
    getSourceMarkerPath,
    isUuidV4,
    readSourceMarker,
    writeManagedSourceMarker,
} from './markers.js';

export {
    requireManagedGitPreflight,
    requireManagedOrigin,
    type ManagedGitPreflightOptions,
    type ManagedGitPreflightResult,
} from './preflight.js';

export {detectSourceMode, type DetectSourceModeInput} from './mode.js';

export {
    buildCredentialConfigSection,
    buildCredentialHelperCommand,
    configureManagedCredentialHelper,
    formatCredentialGetResponse,
    parseCredentialInput,
    runGitCredentialHelper,
    type CredentialHelperOptions,
    type CredentialRequest,
} from './credentials.js';

export {
    createPlatformSourceApi,
    getPlatformBaseUrl,
    stripRepositoryTokenSecret,
    type PlatformSourceApi,
} from './platform-source.js';

export {configureManagedOrigin} from './remote.js';

export {
    assertFastForwardPush,
    pushCurrentBranchSafe,
    type SafePushOptions,
    type SafePushResult,
} from './push.js';

export {
    cloneManagedApp,
    cloneManagedAppCommand,
    type CloneManagedAppOptions,
} from './clone.js';
