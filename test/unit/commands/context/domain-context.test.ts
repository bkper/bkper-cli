import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {getDomainContextDir, pullDomainContext} from '../../../../src/commands/context/domain-context.js';
import {ContextError, ContextForbiddenError, type PlatformContextApi} from '../../../../src/commands/context/platform-context.js';
import {commitAll, initRepo, makeTempDir, runGitSync, writeFile} from '../apps/git/helpers.js';

describe('domain context pull', function () {
    let root: string;
    let home: string;
    let published: string;

    function publish(name: string, content: string): string {
        const other = path.join(root, `other-${Date.now()}-${Math.random()}`);
        initRepo(other);
        runGitSync(['pull', '-q', published, 'main'], other);
        writeFile(other, name, content);
        const sha = commitAll(other, `Publish ${name}`);
        runGitSync(['push', '-q', published, 'HEAD:main'], other);
        return sha;
    }
    const api = (): PlatformContextApi & {calls: Array<[string, string | undefined]>} => {
        const calls: Array<[string, string | undefined]> = [];
        return {
            calls,
            async issueCredential(access, scope) {
                calls.push([access, scope]);
                return fs.existsSync(path.join(published, 'refs', 'heads', 'main'))
                    ? {token: 'read-token', scope: access, expiresAt: '2026-10-01T00:00:00Z', remote: published}
                    : {remote: published};
            },
        };
    };

    beforeEach(function () {
        root = makeTempDir('bkper-domain-context-');
        home = path.join(root, 'home');
        published = path.join(root, 'domain.git');
        runGitSync(['init', '-q', '--bare', '-b', 'main', published], root);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it("keeps the company's context beside the user's, in ~/.bkper/context/domain", function () {
        expect(getDomainContextDir(home)).to.equal(path.join(home, '.bkper', 'context', 'domain'));
    });

    it('clones what the domain published when missing, then fast-forwards; the domain comes from Platform, never named here', async function () {
        publish('AGENTS.md', 'Reports by cost center.\n');
        const platform = api();
        const dir = getDomainContextDir(home);
        expect(await pullDomainContext({home, api: platform})).to.equal('synced');
        expect(platform.calls).to.deep.equal([['read', 'domain']]);
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.equal('Reports by cost center.\n');
        const helpers = runGitSync(['config', '--get-all', `credential.${published}.helper`], dir).stdout.split('\n');
        expect(helpers.slice(0, 2)).to.deep.equal(['', "!bkper context git-credential 'domain'"]);
        expect(runGitSync(['config', '--list'], dir).stdout).to.not.contain('read-token');

        publish('AGENTS.md', 'Reports by cost center, in BRL.\n');
        expect(await pullDomainContext({home, api: api()})).to.equal('synced');
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.contain('in BRL');
    });

    it('sets the clone up before anything was published, ready for the admin to push', async function () {
        expect(await pullDomainContext({home, api: api()})).to.equal('unpublished');
        expect(runGitSync(['remote', 'get-url', 'origin'], getDomainContextDir(home)).stdout.trim()).to.equal(published);
    });

    it('creates nothing for people without a domain (Platform refuses the read), and fails quietly otherwise', async function () {
        const refusing: PlatformContextApi = {
            async issueCredential() {
                throw new ContextForbiddenError('domain');
            },
        };
        expect(await pullDomainContext({home, api: refusing})).to.equal('none');
        expect(fs.existsSync(getDomainContextDir(home))).to.equal(false);
        const failing: PlatformContextApi = {
            async issueCredential() {
                throw new ContextError('Agent context is unavailable (HTTP 502).');
            },
        };
        expect(await pullDomainContext({home, api: failing})).to.equal('failed');
    });
});
