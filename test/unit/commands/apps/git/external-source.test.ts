import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {prepareExternalSource} from '../../../../../src/commands/apps/git/external-source.js';
import {runGit, type GitRunner} from '../../../../../src/commands/apps/git/run-git.js';
import {ManagedGitError} from '../../../../../src/commands/apps/git/types.js';
import {
    commitAll,
    createBareRemote,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps external Git source', function () {
    let tempDir: string;
    let repo: string;

    beforeEach(function () {
        tempDir = makeTempDir('bkper-external-source-');
        repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        writeFile(repo, '.gitignore', 'dist/\n');
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    function offlineFetchRunner(): GitRunner {
        return async (args, options) => {
            if (args[0] === 'fetch') {
                return {stdout: '', stderr: '', exitCode: 0};
            }
            if (args.join(' ') === 'rev-parse --verify FETCH_HEAD') {
                return runGit(['rev-parse', '--verify', 'refs/remotes/upstream/main'], options);
            }
            return runGit(args, options);
        };
    }

    function configureUpstream(head: string): void {
        runGitSync(
            [
                'remote',
                'add',
                'upstream',
                'https://user:secret@github.com/acme/demo.git?token=hidden',
            ],
            repo
        );
        runGitSync(['update-ref', 'refs/remotes/upstream/main', head], repo);
        runGitSync(['branch', '--set-upstream-to', 'upstream/main', 'main'], repo);
    }

    it('returns declared provenance when the clean current commit exists upstream', async function () {
        const head = commitAll(repo, 'initial app');
        configureUpstream(head);

        const source = await prepareExternalSource({
            appDir: repo,
            runner: offlineFetchRunner(),
        });

        expect(source).to.deep.equal({
            branch: 'main',
            commitSha: head,
            remote: 'upstream',
        });
    });

    it('rejects a local commit that is not contained by the upstream branch', async function () {
        const pushedHead = commitAll(repo, 'initial app');
        configureUpstream(pushedHead);
        writeFile(repo, 'next.txt', 'not pushed\n');
        commitAll(repo, 'local only');

        try {
            await prepareExternalSource({
                appDir: repo,
                runner: offlineFetchRunner(),
            });
            expect.fail('expected source storage error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('SOURCE_COMMIT_NOT_PUSHED');
            expect((error as Error).message).to.include(
                'git push --set-upstream upstream main'
            );
        }
    });

    it('rejects an external branch without an upstream instead of guessing a remote', async function () {
        commitAll(repo, 'initial app');
        runGitSync(['remote', 'add', 'origin', 'https://github.com/acme/demo.git'], repo);

        try {
            await prepareExternalSource({appDir: repo});
            expect.fail('expected missing upstream error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('MISSING_SOURCE_UPSTREAM');
            expect((error as Error).message).to.include(
                'git push --set-upstream <remote> main'
            );
        }
    });

    it('rejects a local filesystem remote as durable source storage', async function () {
        commitAll(repo, 'initial app');
        const bare = createBareRemote();
        runGitSync(['remote', 'add', 'origin', `file://${bare}`], repo);
        runGitSync(['push', '--set-upstream', 'origin', 'main'], repo);

        try {
            await prepareExternalSource({appDir: repo});
            expect.fail('expected durable source error');
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
            expect((error as ManagedGitError).code).to.equal('SOURCE_REMOTE_NOT_DURABLE');
        } finally {
            fs.rmSync(bare, {recursive: true, force: true});
        }
    });

});
