import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {requireManagedGitPreflight} from '../../../../../src/commands/apps/git/preflight.js';
import {configureManagedOrigin} from '../../../../../src/commands/apps/git/remote.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {
    ARTIFACTS_REMOTE,
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git preflight', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    async function expectCode(fn: () => Promise<unknown>, code: string): Promise<void> {
        try {
            await fn();
            expect.fail('expected ManagedGitError');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal(code);
        }
    }

    it('requires attached branch, committed HEAD, main on first activation, and clean tree', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');

        await expectCode(
            () => requireManagedGitPreflight({appDir: repo, requireMainBranch: true}),
            'NO_COMMITS'
        );

        commitAll(repo, 'init');
        writeFile(repo, 'dirty.txt', 'x\n');
        await expectCode(
            () => requireManagedGitPreflight({appDir: repo, requireMainBranch: true}),
            'UNTRACKED_FILES'
        );

        fs.rmSync(path.join(repo, 'dirty.txt'));
        runGitSync(['checkout', '--detach', 'HEAD'], repo);
        await expectCode(
            () => requireManagedGitPreflight({appDir: repo, requireMainBranch: true}),
            'DETACHED_HEAD'
        );

        runGitSync(['switch', '-c', 'feature'], repo);
        await expectCode(
            () => requireManagedGitPreflight({appDir: repo, requireMainBranch: true}),
            'FIRST_ACTIVATION_NOT_MAIN'
        );

        runGitSync(['switch', 'main'], repo);
        const ok = await requireManagedGitPreflight({appDir: repo, requireMainBranch: true});
        expect(ok.branch).to.equal('main');
        expect(ok.head).to.match(/^[0-9a-f]{40}$/);
    });

    it('rejects nested monorepo apps for managed preflight', async function () {
        const root = path.join(tempDir, 'mono');
        initRepo(root);
        writeFile(root, 'README.md', 'root\n');
        commitAll(root, 'root');
        const appDir = path.join(root, 'packages', 'app');
        writeFile(appDir, 'bkper.yaml', 'id: nested\n');
        commitAll(root, 'nested');

        await expectCode(
            () => requireManagedGitPreflight({appDir}),
            'BKPER_YAML_NOT_AT_GIT_ROOT'
        );
    });

    it('requires managed origin and never rewrites external origin', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');
        runGitSync(['remote', 'add', 'origin', 'https://github.com/acme/demo.git'], repo);

        await expectCode(
            () =>
                requireManagedGitPreflight({
                    appDir: repo,
                    expectedOriginRemote: ARTIFACTS_REMOTE,
                }),
            'EXTERNAL_ORIGIN_PRESENT'
        );

        await expectCode(
            () => configureManagedOrigin(repo, ARTIFACTS_REMOTE, 'demo-app'),
            'EXTERNAL_ORIGIN_PRESENT'
        );

        const remotes = runGitSync(['remote', '-v'], repo).stdout;
        expect(remotes).to.contain('github.com/acme/demo.git');
        expect(remotes).to.not.contain('artifacts.cloudflare.net');
    });
});
