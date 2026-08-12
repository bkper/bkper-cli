import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {runGit, type GitRunner} from '../../../../../src/commands/apps/git/run-git.js';
import {pushCurrentBranchSafe} from '../../../../../src/commands/apps/git/push.js';
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

describe('apps git safety invariants', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('never issues commit, merge, rebase, force-push, clean, or reset commands', async function () {
        const repo = path.join(tempDir, 'app');
        initRepo(repo);
        writeFile(repo, 'bkper.yaml', 'id: demo-app\n');
        commitAll(repo, 'init');
        await configureManagedOrigin(repo, ARTIFACTS_REMOTE, 'demo-app');

        const seen: string[][] = [];
        const recordingRunner: GitRunner = async (args, options) => {
            seen.push(args);
            // Fail network-facing commands after recording.
            if (args[0] === 'fetch' || args[0] === 'push') {
                return {stdout: '', stderr: 'network disabled', exitCode: 1};
            }
            return runGit(args, options);
        };

        try {
            await pushCurrentBranchSafe({
                appDir: repo,
                expectedOriginRemote: ARTIFACTS_REMOTE,
                runner: recordingRunner,
            });
        } catch (error) {
            expect(error).to.be.instanceOf(ManagedGitError);
        }

        const forbidden = seen.filter(args => {
            return (
                args[0] === 'commit' ||
                args[0] === 'merge' ||
                args[0] === 'rebase' ||
                args[0] === 'reset' ||
                args[0] === 'clean' ||
                (args[0] === 'push' &&
                    (args.includes('--force') ||
                        args.includes('--force-with-lease') ||
                        args.includes('-f')))
            );
        });
        expect(forbidden).to.deep.equal([]);

        // External remote remains untouched when present alongside origin setup attempts.
        runGitSync(['remote', 'add', 'upstream', 'https://github.com/acme/demo.git'], repo);
        const before = runGitSync(['remote', '-v'], repo).stdout;
        try {
            await configureManagedOrigin(repo, ARTIFACTS_REMOTE, 'demo-app');
        } catch {
            // origin already correct; OK
        }
        const after = runGitSync(['remote', '-v'], repo).stdout;
        expect(after).to.equal(before);
        expect(after).to.contain('https://github.com/acme/demo.git');
    });
});
