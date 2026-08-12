import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    prepareManagedDeploySource,
    syncManagedAppSource,
} from '../../../../src/commands/apps/source-workflow.js';
import {
    ensurePendingSourceMarker,
    writeManagedSourceMarker,
} from '../../../../src/commands/apps/git/markers.js';
import {ManagedGitError} from '../../../../src/commands/apps/git/types.js';
import type {
    ManagedSourceActivationResult,
    ManagedSourcePlatformStatus,
    PlatformSourceApi,
    SafePushResult,
} from '../../../../src/commands/apps/git/index.js';
import {
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './git/helpers.js';

const APP_ID = 'demo-app';
const REMOTE =
    'https://example.artifacts.cloudflare.net/git/bkper-app-sources-dev/demo-app.git';

function externalStatus(): ManagedSourcePlatformStatus {
    return {
        mode: 'external',
        state: 'not_managed',
        consistency: 'eventual',
        retryable: true,
    };
}

function managedStatus(): ManagedSourcePlatformStatus {
    return {
        mode: 'managed',
        state: 'active',
        consistency: 'eventual',
        appId: APP_ID,
        repositoryId: 'repo-123',
        repositoryName: APP_ID,
        namespace: 'bkper-app-sources-dev',
        remote: REMOTE,
    };
}

function activationResult(activationId: string): ManagedSourceActivationResult {
    expect(activationId).to.match(/^[0-9a-f-]{36}$/);
    return {
        success: true,
        disposition: 'created',
        source: {
            mode: 'managed',
            appId: APP_ID,
            repositoryId: 'repo-123',
            repositoryName: APP_ID,
            namespace: 'bkper-app-sources-dev',
            remote: REMOTE,
        },
    };
}

function api(
    status: ManagedSourcePlatformStatus | 'feature_disabled' | 'app_not_found',
    calls: string[]
): PlatformSourceApi {
    return {
        async getStatus() {
            calls.push('status');
            return status;
        },
        async activate(_appId, activationId) {
            calls.push(`activate:${activationId}`);
            return activationResult(activationId);
        },
        async issueCredential() {
            throw new Error('credential issuance is not part of workflow orchestration');
        },
    };
}

function pushed(branch: string, head: string): SafePushResult {
    return {branch, head, action: 'pushed'};
}

describe('managed App sync and deploy workflow', function () {
    let tempDir: string;
    let repo: string;

    beforeEach(function () {
        tempDir = makeTempDir('bkper-managed-workflow-');
        repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', `id: ${APP_ID}\n`);
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('persists a pending activation before Core creation, then activates and pushes main', async function () {
        const head = commitAll(repo, 'initial app');
        const calls: string[] = [];
        let observedActivationId: string | undefined;

        const result = await syncManagedAppSource({
            appId: APP_ID,
            appDir: repo,
            coreAppExists: false,
            api: api('app_not_found', calls),
            syncCore: async action => {
                expect(action).to.equal('created');
                const marker = JSON.parse(
                    fs.readFileSync(path.join(repo, '.bkper', 'source-marker.json'), 'utf8')
                ) as {state: string; activationId: string};
                expect(marker.state).to.equal('pending');
                observedActivationId = marker.activationId;
                calls.push('core:create');
            },
            configureOrigin: async (_root, remote, appId) => {
                expect(remote).to.equal(REMOTE);
                expect(appId).to.equal(APP_ID);
                calls.push('origin');
            },
            push: async options => {
                expect(options.requireMainBranch).to.equal(true);
                expect(options.expectedOriginRemote).to.equal(REMOTE);
                calls.push('push:main');
                return pushed('main', head);
            },
        });

        expect(result).to.deep.equal({id: APP_ID, action: 'created'});
        expect(calls).to.deep.equal([
            'status',
            'core:create',
            `activate:${observedActivationId}`,
            'origin',
            'push:main',
        ]);
        expect(
            JSON.parse(fs.readFileSync(path.join(repo, '.bkper', 'source-marker.json'), 'utf8'))
        ).to.deep.equal({version: 1, state: 'managed', appId: APP_ID, remote: REMOTE});
    });

    it('recovers the same pending activation after Core creation succeeded', async function () {
        const head = commitAll(repo, 'initial app');
        const pending = ensurePendingSourceMarker(repo);
        const calls: string[] = [];

        await syncManagedAppSource({
            appId: APP_ID,
            appDir: repo,
            coreAppExists: true,
            api: api(externalStatus(), calls),
            syncCore: async action => {
                calls.push(`core:${action}`);
            },
            configureOrigin: async () => {
                calls.push('origin');
            },
            push: async () => {
                calls.push('push');
                return pushed('main', head);
            },
        });

        expect(calls).to.deep.equal([
            'status',
            'core:updated',
            `activate:${pending.activationId}`,
            'origin',
            'push',
        ]);
    });

    it('preserves existing no-remote, external-remote, and nested Core Apps', async function () {
        commitAll(repo, 'existing app');
        for (const shape of ['no-remote', 'external-remote', 'nested'] as const) {
            const appDir =
                shape === 'nested' ? path.join(repo, 'packages', 'nested-app') : repo;
            if (shape === 'external-remote') {
                runGitSync(['remote', 'add', 'upstream', 'https://github.com/acme/demo.git'], repo);
            }
            if (shape === 'nested') {
                writeFile(appDir, 'bkper.yaml', `id: ${APP_ID}\n`);
            }
            const calls: string[] = [];
            await syncManagedAppSource({
                appId: APP_ID,
                appDir,
                coreAppExists: true,
                api: api(externalStatus(), calls),
                syncCore: async action => {
                    calls.push(`core:${action}`);
                },
                configureOrigin: async () => {
                    calls.push('origin');
                },
                push: async () => {
                    calls.push('push');
                    return pushed('main', '0'.repeat(40));
                },
            });
            expect(calls).to.deep.equal(['status', 'core:updated']);
            if (shape === 'external-remote') {
                runGitSync(['remote', 'remove', 'upstream'], repo);
            }
            if (shape === 'nested') {
                fs.rmSync(path.join(repo, 'packages'), {recursive: true, force: true});
            }
        }
    });

    for (const branch of ['main', 'feature/change', 'rollback/known-good']) {
        it(`prepares managed deploy provenance from attached branch ${branch} before bundle upload`, async function () {
                const head = commitAll(repo, 'initial app');
                if (branch !== 'main') {
                    runGitSync(['switch', '-c', branch], repo);
                }
                const calls: string[] = [];
                const source = await prepareManagedDeploySource({
                    appId: APP_ID,
                    appDir: repo,
                    api: api(managedStatus(), calls),
                    push: async options => {
                        expect(options.expectedOriginRemote).to.equal(REMOTE);
                        calls.push(`push:${branch}`);
                        return pushed(branch, head);
                    },
                });

                expect(source).to.deep.equal({
                    mode: 'managed',
                    declaredBranch: branch,
                    commitSha: head,
                });
                expect(calls).to.deep.equal(['status', `push:${branch}`]);
            }
        );
    }

    it('preserves unauthenticated proxy deployment only when no local managed marker exists', async function () {
        commitAll(repo, 'external app');
        const unauthenticated: PlatformSourceApi = {
            async getStatus() {
                throw new ManagedGitError('AUTHENTICATION_REQUIRED', 'login required');
            },
            async activate() {
                throw new Error('not used');
            },
            async issueCredential() {
                throw new Error('not used');
            },
        };

        const external = await prepareManagedDeploySource({
            appId: APP_ID,
            appDir: repo,
            api: unauthenticated,
        });
        expect(external).to.equal(undefined);

        writeManagedSourceMarker(repo, APP_ID, REMOTE);
        try {
            await prepareManagedDeploySource({appId: APP_ID, appDir: repo, api: unauthenticated});
            expect.fail('expected managed authentication failure');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('AUTHENTICATION_REQUIRED');
        }
    });

    it('keeps feature-disabled and external deploys source-less', async function () {
        commitAll(repo, 'external app');
        for (const status of ['feature_disabled', externalStatus()] as const) {
            const calls: string[] = [];
            const source = await prepareManagedDeploySource({
                appId: APP_ID,
                appDir: repo,
                api: api(status, calls),
                push: async () => {
                    throw new Error('external deploy must not push');
                },
            });
            expect(source).to.equal(undefined);
        }
    });
});
