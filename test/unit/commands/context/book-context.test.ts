import {expect} from '../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    bookFolderName,
    bookIdOfClone,
    cloneBookContext,
} from '../../../../src/commands/context/book-context.js';
import {ContextForbiddenError, type PlatformContextApi} from '../../../../src/commands/context/platform-context.js';
import {commitAll, initRepo, makeTempDir, runGitSync, writeFile} from '../apps/git/helpers.js';

const BOOK_ID = 'agtzfmJrcGVyLWhyZHITCxIGTGVkZ2Vy';

describe('Book context clone', function () {
    let root: string;
    let published: string;

    function publish(name: string, content: string): string {
        const other = path.join(root, `other-${Date.now()}-${Math.random()}`);
        initRepo(other);
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
    const named = (name: string) => async (bookId: string) => {
        expect(bookId).to.equal(BOOK_ID);
        return name;
    };

    beforeEach(function () {
        root = makeTempDir('bkper-book-context-');
        published = path.join(root, 'book.git');
        runGitSync(['init', '-q', '--bare', '-b', 'main', published], root);
    });
    afterEach(function () {
        fs.rmSync(root, {recursive: true, force: true});
    });

    it('names the default folder after the Book, folder-safe', function () {
        expect(bookFolderName('Acme Ltda. — 2026', BOOK_ID)).to.equal('acme-ltda-2026');
        expect(bookFolderName('São Paulo / Filial', BOOK_ID)).to.equal('sao-paulo-filial');
        expect(bookFolderName('  ...  ', BOOK_ID)).to.equal(BOOK_ID);
    });

    it("clones what the Book published into a folder named after it, recording the Book ID only in Git's config", async function () {
        publish('AGENTS.md', 'Account Caixa is petty cash.\n');
        const platform = api();
        const result = await cloneBookContext({bookId: BOOK_ID, cwd: root, api: platform, bookName: named('Acme Ltda.')});
        const dir = path.join(root, 'acme-ltda');
        expect(result).to.deep.equal({dir, outcome: 'synced'});
        expect(platform.calls).to.deep.equal([['read', `books/${BOOK_ID}`]]);
        expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).to.equal('Account Caixa is petty cash.\n');
        expect(bookIdOfClone(dir)).to.equal(BOOK_ID);
        fs.mkdirSync(path.join(dir, '.agents', 'skills'), {recursive: true});
        expect(bookIdOfClone(path.join(dir, '.agents', 'skills'))).to.equal(BOOK_ID);
        expect(bookIdOfClone(root)).to.equal(undefined);
        const helpers = runGitSync(['config', '--get-all', `credential.${published}.helper`], dir).stdout.split('\n');
        expect(helpers.slice(0, 2)).to.deep.equal(['', `!bkper context git-credential 'books/${BOOK_ID}'`]);
        expect(runGitSync(['config', '--list'], dir).stdout).to.not.contain('read-token');
        expect(runGitSync(['status', '--porcelain'], dir).stdout).to.equal('');
    });

    it('clones into the folder given, ready to push before anything was published', async function () {
        const missing = path.join(root, 'missing.git');
        const result = await cloneBookContext({bookId: BOOK_ID, folder: 'ctx', cwd: root, api: api(missing), bookName: named('x')});
        expect(result).to.deep.equal({dir: path.join(root, 'ctx'), outcome: 'unpublished'});
        expect(runGitSync(['remote', 'get-url', 'origin'], result.dir).stdout.trim()).to.equal(missing);
        expect(bookIdOfClone(result.dir)).to.equal(BOOK_ID);
    });

    it('stops with a clear message when the folder exists, changing nothing', async function () {
        fs.mkdirSync(path.join(root, 'acme'));
        const platform = api();
        let message = '';
        try {
            await cloneBookContext({bookId: BOOK_ID, cwd: root, api: platform, bookName: named('Acme')});
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }
        expect(message).to.contain(path.join(root, 'acme'));
        expect(message).to.contain('already exists');
        expect(message).to.contain(`bkper book clone ${BOOK_ID} <folder>`);
        expect(platform.calls).to.deep.equal([]);
        expect(fs.readdirSync(path.join(root, 'acme'))).to.deep.equal([]);
    });

    it('creates nothing when the person cannot view the Book, and refuses malformed Book IDs', async function () {
        const refusing: PlatformContextApi = {
            async issueCredential() {
                throw new ContextForbiddenError();
            },
        };
        let failure: unknown;
        try {
            await cloneBookContext({bookId: BOOK_ID, cwd: root, api: refusing, bookName: named('Acme')});
        } catch (error) {
            failure = error;
        }
        expect(failure).to.be.instanceOf(ContextForbiddenError);
        expect(fs.existsSync(path.join(root, 'acme'))).to.equal(false);
        let malformed = '';
        try {
            await cloneBookContext({bookId: '../x', cwd: root, api: api(), bookName: named('x')});
        } catch (error) {
            malformed = error instanceof Error ? error.message : String(error);
        }
        expect(malformed).to.contain('Book ID');
    });
});
