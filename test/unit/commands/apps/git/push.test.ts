import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {configureManagedOrigin} from '../../../../../src/commands/apps/git/remote.js';
import {
    assertFastForwardPush,
    pushCurrentBranchSafe,
} from '../../../../../src/commands/apps/git/push.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {
    commitAll,
    createBareRemote,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git safe push', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    function fileUrl(dir: string): string {
        return `file://${dir}`;
    }

    it('pushes the current branch with upstream and allows equal/missing remote tips', async function () {
        const bare = createBareRemote();
        // file:// remotes are not Artifacts; bypass origin check by using preflight without expected remote
        // and a custom runner path via direct git remote named origin after temporary local setup.
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        const head = commitAll(repo, 'init');
        runGitSync(['remote', 'add', 'origin', fileUrl(bare)], repo);

        // First push creates remote branch.
        const first = await assertFastForwardPush(repo, 'main', head);
        expect(first).to.equal('missing');
        runGitSync(['push', '-u', 'origin', 'HEAD:main'], repo);

        const same = await assertFastForwardPush(repo, 'main', head);
        expect(same).to.equal('same');

        writeFile(repo, 'next.txt', 'n\n');
        const nextHead = commitAll(repo, 'next');
        const ahead = await assertFastForwardPush(repo, 'main', nextHead);
        expect(ahead).to.equal('ahead');
        runGitSync(['push', 'origin', 'HEAD:main'], repo);
    });

    it('stops when remote is ahead or divergent and never force-pushes', async function () {
        const bare = createBareRemote();
        const repoA = path.join(tempDir, 'a');
        const repoB = path.join(tempDir, 'b');
        initRepo(repoA);
        writeFile(repoA, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repoA, 'init');
        runGitSync(['remote', 'add', 'origin', fileUrl(bare)], repoA);
        runGitSync(['push', '-u', 'origin', 'HEAD:main'], repoA);

        runGitSync(['clone', fileUrl(bare), repoB], tempDir);
        runGitSync(['config', 'user.email', 'test@example.com'], repoB);
        runGitSync(['config', 'user.name', 'Test User'], repoB);
        runGitSync(['config', 'commit.gpgsign', 'false'], repoB);
        writeFile(repoB, 'other.txt', 'b\n');
        commitAll(repoB, 'from-b');
        runGitSync(['push', 'origin', 'HEAD:main'], repoB);

        writeFile(repoA, 'local.txt', 'a\n');
        const localHead = commitAll(repoA, 'from-a');

        try {
            await assertFastForwardPush(repoA, 'main', localHead);
            expect.fail('expected divergence error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('REMOTE_AHEAD_OR_DIVERGED');
            expect((error as ManagedGitError).message).to.not.match(/--force/);
        }

        // Ensure local branch was not force-updated away.
        expect(runGitSync(['rev-parse', 'HEAD'], repoA).stdout.trim()).to.equal(localHead);
    });

    it('configures Artifacts origin only and safe push refuses external origin rewrite', async function () {
        const repo = path.join(tempDir, 'managed');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');

        const artifactsRemote =
            'https://example.artifacts.cloudflare.net/git/bkper-app-sources-dev/demo-app.git';
        await configureManagedOrigin(repo, artifactsRemote, 'demo-app');
        const origin = runGitSync(['remote', 'get-url', 'origin'], repo).stdout.trim();
        expect(origin).to.equal(artifactsRemote);

        runGitSync(['remote', 'remove', 'origin'], repo);
        runGitSync(['remote', 'add', 'origin', 'https://github.com/acme/demo.git'], repo);

        try {
            await pushCurrentBranchSafe({
                appDir: repo,
                expectedOriginRemote: artifactsRemote,
            });
            expect.fail('expected external origin error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('EXTERNAL_ORIGIN_PRESENT');
        }

        expect(runGitSync(['remote', 'get-url', 'origin'], repo).stdout.trim()).to.equal(
            'https://github.com/acme/demo.git'
        );
    });
});
