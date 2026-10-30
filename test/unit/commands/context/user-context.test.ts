import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {pullUserContext} from '../../../../src/commands/context/user-context.js';
import type {PlatformContextApi} from '../../../../src/commands/context/platform-context.js';
import {runGit, type GitRunner} from '../../../../src/commands/apps/git/run-git.js';
import {commitAll, initRepo, makeTempDir, runGitSync, writeFile} from '../apps/git/helpers.js';

describe('user context clone', function () {
    let root: string;
    let published: string;
    let dir: string;

    /** Publish a file to the bare repository standing in for the user's context, as another agent would. */
    function publish(name: string, content: string): string {
        const other = path.join(root, `other-${Date.now()}-${Math.random()}`);
        initRepo(other);
        runGitSync(['pull', '-q', published, 'main'], other);
        writeFile(other, name, content);
        const sha = commitAll(other, `Publish ${name}`);
        runGitSync(['push', '-q', published, 'HEAD:main'], other);
        return sha;
    }
    const api = (remote = published): PlatformContextApi & {calls: string[]} => {
        const calls: string[] = [];
        return {
            calls,
            async issueCredential(access) {
                calls.push(access);
                return fs.existsSync(path.join(remote, 'HEAD'))
                    ? {token: 'read-token?expires=1', scope: access, expiresAt: '2026-10-01T00:00:00Z', remote}
                    : {remote};
            },
        };
    };

    beforeEach(function () {
        root = makeTempDir('bkper-context-');
        published = path.join(root, 'user.git');
        dir = path.join(root, 'home', '.bkper', 'context', 'user');
        runGitSync(['init', '-q', '--bare', '-b', 'main', published], root);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it('prepares an empty clone, ready to push, before anything was published', async function () {
        const missing = path.join(root, 'missing.git');
        const outcome = await pullUserContext({dir, api: api(missing)});
        expect(outcome).to.equal('unpublished');
        expect(runGitSync(['remote', 'get-url', 'origin'], dir).stdout.trim()).to.equal(missing);
        expect(runGitSync(['config', 'branch.main.merge'], dir).stdout.trim()).to.equal('refs/heads/main');
        const helpers = runGitSync(['config', '--get-all', `credential.${missing}.helper`], dir)
            .stdout.split('\n');
        expect(helpers.slice(0, 2)).to.deep.equal(['', "!bkper context git-credential 'user'"]);
    });

    it('clones what was published with a read credential, then fast-forwards to newer pushes', async function () {
        const first = publish('AGENTS.md', 'Answer in Portuguese.\n');
        const platform = api();
        const seen: NodeJS.ProcessEnv[] = [];
        const runner: GitRunner = (args, options) => {
            if (args[0] === 'fetch') seen.push(options?.env ?? {});
            return runGit(args, options);
        };
        expect(await pullUserContext({dir, api: platform, runner})).to.equal('synced');
        expect(platform.calls).to.deep.equal(['read']);
        expect(runGitSync(['rev-parse', 'HEAD'], dir).stdout.trim()).to.equal(first);
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.equal('Answer in Portuguese.\n');
        // The fetch's helper gets the pre-issued read token; nothing is stored.
        expect(seen[0]?.BKPER_CONTEXT_TOKEN).to.equal('read-token?expires=1');
        expect(seen[0]?.BKPER_CONTEXT_REMOTE).to.equal(published);
        expect(runGitSync(['config', '--list'], dir).stdout).to.not.contain('read-token');

        const second = publish('AGENTS.md', 'Answer in English.\n');
        expect(await pullUserContext({dir, api: platform})).to.equal('synced');
        expect(runGitSync(['rev-parse', 'HEAD'], dir).stdout.trim()).to.equal(second);
    });

    it('leaves a clone with unpushed changes as it is', async function () {
        const first = publish('AGENTS.md', 'v1\n');
        await pullUserContext({dir, api: api()});
        publish('AGENTS.md', 'v2\n');
        writeFile(dir, 'draft.md', 'not pushed');
        expect(await pullUserContext({dir, api: api()})).to.equal('unpushed');
        expect(runGitSync(['rev-parse', 'HEAD'], dir).stdout.trim()).to.equal(first);
    });

    it('fails quietly when Platform or Git cannot be reached', async function () {
        const failing: PlatformContextApi = {
            async issueCredential() {
                throw new Error('offline');
            },
        };
        expect(await pullUserContext({dir, api: failing})).to.equal('failed');
    });
});
