/**
 * Managed Artifacts source types and agent-actionable errors for CLI Git plumbing.
 */

export type SourceMode = 'managed' | 'external' | 'pending_activation';

export type ManagedSourcePlatformStatus =
    | {
          mode: 'external';
          state: 'not_managed';
          consistency: 'eventual';
          retryable: true;
      }
    | {
          mode: 'managed';
          state: 'active';
          consistency: 'eventual';
          appId: string;
          repositoryId: string;
          repositoryName: string;
          namespace: string;
          remote: string;
      };

export interface ManagedSourceActivationResult {
    success: true;
    disposition: 'created' | 'adopted' | 'existing';
    source: {
        mode: 'managed';
        appId: string;
        repositoryId: string;
        repositoryName: string;
        namespace: string;
        remote: string;
    };
}

export interface ManagedSourceCredential {
    token: string;
    scope: 'read' | 'write';
    expiresAt: string;
    remote: string;
}

export type SourceMarker =
    | {
          version: 1;
          state: 'pending';
          activationId: string;
      }
    | {
          version: 1;
          state: 'managed';
          appId: string;
          remote: string;
      };

export interface GitRemote {
    name: string;
    url: string;
    isArtifacts: boolean;
}

export interface GitRepositoryInfo {
    root: string;
    branch: string | null;
    head: string | null;
    detached: boolean;
    hasCommits: boolean;
    remotes: GitRemote[];
    isNestedApp: boolean;
    bkperYamlPath: string | null;
}

export interface WorkingTreeStatus {
    clean: boolean;
    staged: string[];
    modified: string[];
    untracked: string[];
}

export type SourceModeDecision =
    | {
          mode: 'managed';
          reason: 'platform_record' | 'pending_marker';
          appId: string;
          remote?: string;
          activationId?: string;
      }
    | {
          mode: 'external';
          reason:
              | 'nested_app'
              | 'external_remote'
              | 'existing_core_app'
              | 'not_git_root'
              | 'no_git'
              | 'platform_external'
              | 'feature_disabled';
          details?: string;
      }
    | {
          mode: 'activate_managed';
          reason: 'new_standalone_app';
          appId: string;
      };

export type GitPreflightCode =
    | 'NO_GIT_REPOSITORY'
    | 'BKPER_YAML_NOT_AT_GIT_ROOT'
    | 'NO_COMMITS'
    | 'DETACHED_HEAD'
    | 'FIRST_ACTIVATION_NOT_MAIN'
    | 'STAGED_CHANGES'
    | 'MODIFIED_TRACKED_FILES'
    | 'UNTRACKED_FILES'
    | 'MISSING_MANAGED_ORIGIN'
    | 'INCORRECT_MANAGED_ORIGIN'
    | 'EXTERNAL_ORIGIN_PRESENT'
    | 'AUTHENTICATION_REQUIRED'
    | 'REPOSITORY_CREDENTIAL_EXPIRED'
    | 'REMOTE_AHEAD_OR_DIVERGED'
    | 'APP_ID_MISMATCH'
    | 'MANAGED_SOURCE_UNAVAILABLE'
    | 'EXTERNAL_SOURCE_CLONE'
    | 'CLONE_DESTINATION_EXISTS'
    | 'CLONE_EMPTY_REPOSITORY'
    | 'INVALID_CREDENTIAL_REQUEST'
    | 'SOURCE_MARKER_INVALID'
    | 'GIT_COMMAND_FAILED';

export class ManagedGitError extends Error {
    readonly code: GitPreflightCode;
    readonly files: string[];

    constructor(code: GitPreflightCode, message: string, files: string[] = []) {
        super(message);
        this.name = 'ManagedGitError';
        this.code = code;
        this.files = files;
    }
}

export const ARTIFACTS_HOST_SUFFIX = '.artifacts.cloudflare.net';
export const SOURCE_MARKER_DIR = '.bkper';
export const SOURCE_MARKER_FILE = 'source-marker.json';
export const DEFAULT_MANAGED_BRANCH = 'main';
export const CREDENTIAL_USERNAME = 'x';
