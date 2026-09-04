import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    prepareManagedDeploySource,
    syncManagedAppSource,
} from '../../../../src/commands/apps/source-workflow.js';
import {
    ensurePendingSourceMarker,
    readSourceMarker,
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
const EXTERNAL_SOURCE = {
    branch: 'main',
    commitSha: '1111111111111111111111111111111111111111',
    remote: 'upstream',
};

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
                expect(options.upload).to.equal('main');
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

    it('activates an existing no-remote App and uploads all local refs', async function () {
        const head = commitAll(repo, 'existing app');
        const calls: string[] = [];

        const result = await syncManagedAppSource({
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
            push: async options => {
                expect(options.upload).to.equal('all_refs');
                calls.push('push:all_refs');
                return pushed('main', head);
            },
        });

        expect(result).to.deep.equal({id: APP_ID, action: 'updated'});
        expect(calls[0]).to.equal('status');
        expect(calls[1]).to.equal('core:updated');
        expect(calls[2]).to.match(/^activate:/);
        expect(calls.slice(3)).to.deep.equal(['origin', 'push:all_refs']);
    });

    it('retries the complete migration upload from its pending marker', async function () {
        const head = commitAll(repo, 'existing app');
        const pending = ensurePendingSourceMarker(repo, 'all_refs');
        const calls: string[] = [];

        await syncManagedAppSource({
            appId: APP_ID,
            appDir: repo,
            coreAppExists: true,
            api: api(managedStatus(), calls),
            syncCore: async action => {
                calls.push(`core:${action}`);
            },
            configureOrigin: async () => {
                calls.push('origin');
            },
            push: async options => {
                expect(options.upload).to.equal('all_refs');
                calls.push('push:all_refs');
                return pushed('main', head);
            },
        });

        expect(calls).to.deep.equal([
            'status',
            'core:updated',
            `activate:${pending.activationId}`,
            'origin',
            'push:all_refs',
        ]);
    });

    it('preserves existing external-remote and nested Core Apps', async function () {
        commitAll(repo, 'existing app');
        for (const shape of ['external-remote', 'nested'] as const) {
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
                prepareExternal: async () => {
                    calls.push('external');
                    return EXTERNAL_SOURCE;
                },
            });
            expect(calls).to.deep.equal(['status', 'external', 'core:updated']);
            if (shape === 'external-remote') {
                runGitSync(['remote', 'remove', 'upstream'], repo);
            }
            if (shape === 'nested') {
                fs.rmSync(path.join(repo, 'packages'), {recursive: true, force: true});
            }
        }
    });

    it('requires sync to finish a pending migration before deploy', async function () {
        commitAll(repo, 'existing app');
        ensurePendingSourceMarker(repo, 'all_refs');
        const calls: string[] = [];

        try {
            await prepareManagedDeploySource({
                appId: APP_ID,
                appDir: repo,
                api: api(managedStatus(), calls),
                push: async () => {
                    calls.push('push');
                    return pushed('main', '0'.repeat(40));
                },
            });
            expect.fail('expected pending migration error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal(
                'MANAGED_SOURCE_UNAVAILABLE'
            );
        }

        expect(calls).to.deep.equal(['status']);
        expect(readSourceMarker(repo)).to.deep.include({
            state: 'pending',
            upload: 'all_refs',
        });
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
                        expect(options.skipPushIfTrackingRefMatches).to.equal(true);
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

    it('verifies external source through an unauthenticated deployment proxy', async function () {
        commitAll(repo, 'external app');
        runGitSync(['remote', 'add', 'upstream', 'https://github.com/acme/demo.git'], repo);
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
            prepareExternal: async () => EXTERNAL_SOURCE,
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

    it('verifies feature-disabled and external Apps before source-less upload', async function () {
        commitAll(repo, 'external app');
        runGitSync(['remote', 'add', 'upstream', 'https://github.com/acme/demo.git'], repo);
        for (const status of ['feature_disabled', externalStatus()] as const) {
            const calls: string[] = [];
            const source = await prepareManagedDeploySource({
                appId: APP_ID,
                appDir: repo,
                api: api(status, calls),
                push: async () => {
                    throw new Error('external deploy must not push');
                },
                prepareExternal: async () => {
                    calls.push('external');
                    return EXTERNAL_SOURCE;
                },
            });
            expect(source).to.equal(undefined);
            expect(calls).to.deep.equal(['status', 'external']);
        }
    });

    it('rejects sync before Core mutation when the App has no Git repository', async function () {
        const appDir = path.join(tempDir, 'no-git-app');
        fs.mkdirSync(appDir, {recursive: true});
        writeFile(appDir, 'bkper.yaml', `id: ${APP_ID}\n`);
        const calls: string[] = [];

        try {
            await syncManagedAppSource({
                appId: APP_ID,
                appDir,
                coreAppExists: false,
                api: api('app_not_found', calls),
                syncCore: async () => {
                    calls.push('core');
                },
            });
            expect.fail('expected Git source requirement');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('NO_GIT_REPOSITORY');
            expect((error as Error).message).to.include('bkper app sync');
        }

        expect(calls).to.deep.equal([]);
    });

    it('rejects deploy before Platform lookup when the App has no Git repository', async function () {
        const appDir = path.join(tempDir, 'no-git-deploy');
        fs.mkdirSync(appDir, {recursive: true});
        writeFile(appDir, 'bkper.yaml', `id: ${APP_ID}\n`);
        const calls: string[] = [];

        try {
            await prepareManagedDeploySource({
                appId: APP_ID,
                appDir,
                api: api(externalStatus(), calls),
            });
            expect.fail('expected Git source requirement');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('NO_GIT_REPOSITORY');
        }

        expect(calls).to.deep.equal([]);
    });

    it('requires sync before deploying a standalone repository without a remote', async function () {
        commitAll(repo, 'initial app');
        const calls: string[] = [];

        try {
            await prepareManagedDeploySource({
                appId: APP_ID,
                appDir: repo,
                api: api(externalStatus(), calls),
            });
            expect.fail('expected managed activation guidance');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('MANAGED_SOURCE_UNAVAILABLE');
            expect((error as Error).message).to.include('bkper app sync');
        }
    });
});
