import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {getBookContextDir, pullBookContext} from '../../../../src/commands/context/book-context.js';
import {ContextForbiddenError, type PlatformContextApi} from '../../../../src/commands/context/platform-context.js';
import {commitAll, initRepo, makeTempDir, runGitSync, writeFile} from '../apps/git/helpers.js';

const BOOK_ID = 'agtzfmJrcGVyLWhyZHITCxIGTGVkZ2Vy';

describe('Book context pull', function () {
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
    const api = (remote = published): PlatformContextApi & {calls: Array<[string, string | undefined]>} => {
        const calls: Array<[string, string | undefined]> = [];
        return {
            calls,
            async issueCredential(access, scope) {
                calls.push([access, scope]);
                return fs.existsSync(path.join(remote, 'refs', 'heads', 'main'))
                    ? {token: 'read-token', scope: access, expiresAt: '2026-10-01T00:00:00Z', remote}
                    : {remote};
            },
        };
    };

    beforeEach(function () {
        root = makeTempDir('bkper-book-context-');
        home = path.join(root, 'home');
        published = path.join(root, 'book.git');
        runGitSync(['init', '-q', '--bare', '-b', 'main', published], root);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it("keeps each Book's context in a folder named by its ID, beside the user's", function () {
        expect(getBookContextDir(BOOK_ID, home)).to.equal(path.join(home, '.bkper', 'context', 'books', BOOK_ID));
    });

    it('clones what the Book published when missing, then fast-forwards, with no Book ID in Git config', async function () {
        publish('AGENTS.md', 'Account Caixa is petty cash.\n');
        const platform = api();
        const dir = getBookContextDir(BOOK_ID, home);
        expect(await pullBookContext(BOOK_ID, {home, api: platform})).to.equal('synced');
        expect(platform.calls).to.deep.equal([['read', `books/${BOOK_ID}`]]);
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.equal('Account Caixa is petty cash.\n');
        const helpers = runGitSync(['config', '--get-all', `credential.${published}.helper`], dir).stdout.split('\n');
        expect(helpers.slice(0, 2)).to.deep.equal(['', `!bkper context git-credential 'books/${BOOK_ID}'`]);
        expect(runGitSync(['config', '--list'], dir).stdout).to.not.contain('bookid');
        expect(runGitSync(['config', '--list'], dir).stdout).to.not.contain('read-token');

        publish('AGENTS.md', 'Account Caixa is petty cash. Close on the 5th.\n');
        expect(await pullBookContext(BOOK_ID, {home, api: api()})).to.equal('synced');
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.contain('Close on the 5th');
    });

    it('leaves unpushed changes alone and says so', async function () {
        publish('AGENTS.md', 'One.\n');
        const dir = getBookContextDir(BOOK_ID, home);
        await pullBookContext(BOOK_ID, {home, api: api()});
        fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'Mine, not pushed.\n');
        publish('AGENTS.md', 'Two.\n');
        expect(await pullBookContext(BOOK_ID, {home, api: api()})).to.equal('unpushed');
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.equal('Mine, not pushed.\n');
    });

    it('creates nothing when the person cannot view the Book, and refuses malformed Book IDs', async function () {
        const refusing: PlatformContextApi = {
            async issueCredential() {
                throw new ContextForbiddenError();
            },
        };
        expect(await pullBookContext(BOOK_ID, {home, api: refusing})).to.equal('forbidden');
        expect(fs.existsSync(getBookContextDir(BOOK_ID, home))).to.equal(false);
        const platform = api();
        expect(await pullBookContext('../x', {home, api: platform})).to.equal('failed');
        expect(platform.calls).to.deep.equal([]);
    });
});
