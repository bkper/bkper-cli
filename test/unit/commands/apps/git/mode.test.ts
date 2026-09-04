import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {detectSourceMode} from '../../../../../src/commands/apps/git/mode.js';
import {
    ensurePendingSourceMarker,
    writeManagedSourceMarker,
} from '../../../../../src/commands/apps/git/markers.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {
    ARTIFACTS_REMOTE,
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git source mode detection', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('rejects an unversioned App instead of classifying it as external', async function () {
        const appDir = path.join(tempDir, 'no-git');
        fs.mkdirSync(appDir, {recursive: true});
        writeFile(appDir, 'bkper.yaml', 'id: demo-app\n');

        try {
            await detectSourceMode({
                appDir,
                appId: 'demo-app',
                coreAppExists: false,
                platformStatus: null,
            });
            expect.fail('expected Git source requirement');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('NO_GIT_REPOSITORY');
        }
    });

    it('prefers Platform managed status over local shape', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');
        runGitSync(['remote', 'add', 'origin', 'https://github.com/acme/demo.git'], repo);

        const decision = await detectSourceMode({
            appDir: repo,
            appId: 'demo-app',
            coreAppExists: true,
            platformStatus: {
                mode: 'managed',
                state: 'active',
                consistency: 'eventual',
                appId: 'demo-app',
                repositoryId: 'repo-1',
                repositoryName: 'demo-app',
                namespace: 'bkper-app-sources-dev',
                remote: ARTIFACTS_REMOTE,
            },
        });

        expect(decision).to.deep.equal({
            mode: 'managed',
            reason: 'platform_record',
            appId: 'demo-app',
        });
    });

    it('resumes pending marker even when Platform status is external', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');
        const pending = ensurePendingSourceMarker(repo);

        const decision = await detectSourceMode({
            appDir: repo,
            appId: 'demo-app',
            coreAppExists: true,
            platformStatus: {
                mode: 'external',
                state: 'not_managed',
                consistency: 'eventual',
                retryable: true,
            },
        });

        expect(decision.mode).to.equal('managed');
        if (decision.mode === 'managed') {
            expect(decision.reason).to.equal('pending_marker');
            expect(decision.activationId).to.equal(pending.activationId);
        }
    });

    it('keeps external mode for nested apps and external remotes', async function () {
        const mono = path.join(tempDir, 'mono');
        initRepo(mono);
        writeFile(mono, 'README.md', 'root\n');
        commitAll(mono, 'root');
        const nested = path.join(mono, 'apps', 'x');
        writeFile(nested, 'bkper.yaml', 'id: nested\n');
        commitAll(mono, 'nested');

        expect(
            (
                await detectSourceMode({
                    appDir: nested,
                    appId: 'nested',
                    coreAppExists: false,
                    platformStatus: {
                        mode: 'external',
                        state: 'not_managed',
                        consistency: 'eventual',
                        retryable: true,
                    },
                })
            ).reason
        ).to.equal('nested_app');

        const external = path.join(tempDir, 'external');
        initRepo(external);
        writeFile(external, 'bkper.yaml', 'id: external-app\n');
        commitAll(external, 'init');
        runGitSync(['remote', 'add', 'origin', 'https://gitlab.com/acme/app.git'], external);
        expect(
            (
                await detectSourceMode({
                    appDir: external,
                    appId: 'external-app',
                    coreAppExists: false,
                    platformStatus: {
                        mode: 'external',
                        state: 'not_managed',
                        consistency: 'eventual',
                        retryable: true,
                    },
                })
            ).reason
        ).to.equal('external_remote');
    });

    it('selects migration for existing standalone apps with no remotes', async function () {
        const repo = path.join(tempDir, 'existing');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: existing-app\n');
        commitAll(repo, 'init');

        const decision = await detectSourceMode({
            appDir: repo,
            appId: 'existing-app',
            coreAppExists: true,
            platformStatus: {
                mode: 'external',
                state: 'not_managed',
                consistency: 'eventual',
                retryable: true,
            },
        });

        expect(decision).to.deep.equal({
            mode: 'activate_managed',
            reason: 'existing_standalone_app',
            appId: 'existing-app',
            upload: 'all_refs',
        });
    });

    it('selects activate_managed for new standalone apps with no remotes', async function () {
        const repo = path.join(tempDir, 'new-app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: new-app\n');
        commitAll(repo, 'init');

        const decision = await detectSourceMode({
            appDir: repo,
            appId: 'new-app',
            coreAppExists: false,
            platformStatus: {
                mode: 'external',
                state: 'not_managed',
                consistency: 'eventual',
                retryable: true,
            },
        });

        expect(decision).to.deep.equal({
            mode: 'activate_managed',
            reason: 'new_standalone_app',
            appId: 'new-app',
            upload: 'main',
        });
    });

    it('uses local managed marker remote when present', async function () {
        const repo = path.join(tempDir, 'marked');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: marked-app\n');
        commitAll(repo, 'init');
        writeManagedSourceMarker(repo, 'marked-app', ARTIFACTS_REMOTE);

        const decision = await detectSourceMode({
            appDir: repo,
            appId: 'marked-app',
            coreAppExists: true,
            platformStatus: {
                mode: 'external',
                state: 'not_managed',
                consistency: 'eventual',
                retryable: true,
            },
        });

        expect(decision).to.deep.include({
            mode: 'managed',
            appId: 'marked-app',
            remote: ARTIFACTS_REMOTE,
        });
    });
});
