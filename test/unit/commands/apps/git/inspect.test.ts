import {expect} from '../../../helpers/test-setup.js';
import fs from 'fs';
import path from 'path';
import {
    ensureGitInitialized,
    findGitRoot,
    hasExternalRemote,
    inspectGitRepository,
    isArtifactsRemoteUrl,
    listRemotes,
} from '../../../../../src/commands/apps/git/inspect.js';
import {
    ARTIFACTS_REMOTE,
    commitAll,
    initRepo,
    makeTempDir,
    runGitSync,
    writeFile,
} from './helpers.js';

describe('apps git inspect', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = makeTempDir();
    });

    afterEach(function () {
        fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('detects Artifacts HTTPS remotes and rejects external providers', function () {
        expect(isArtifactsRemoteUrl(ARTIFACTS_REMOTE)).to.equal(true);
        expect(isArtifactsRemoteUrl('https://github.com/bkper/app.git')).to.equal(false);
        expect(isArtifactsRemoteUrl('git@github.com:bkper/app.git')).to.equal(false);
    });

    it('finds the git root and nested monorepo apps', async function () {
        const root = path.join(tempDir, 'mono');
        initRepo(root);
        writeFile(root, 'README.md', 'mono\n');
        commitAll(root, 'root');
        const appDir = path.join(root, 'apps', 'nested-app');
        writeFile(appDir, 'bkper.yaml', 'id: nested-app\n');

        const rootFound = await findGitRoot(appDir);
        expect(rootFound).to.equal(root);

        const info = await inspectGitRepository(appDir);
        expect(info).to.not.equal(null);
        expect(info!.isNestedApp).to.equal(true);
        expect(info!.root).to.equal(root);
    });

    it('lists remotes without modifying them and detects external remotes', async function () {
        const root = path.join(tempDir, 'repo');
        initRepo(root);
        writeFile(root, 'bkper.yaml', 'id: demo-app\n');
        commitAll(root, 'init');
        runGitSync(['remote', 'add', 'origin', 'https://github.com/acme/demo-app.git'], root);
        runGitSync(['remote', 'add', 'artifacts', ARTIFACTS_REMOTE], root);

        const before = runGitSync(['remote', '-v'], root).stdout;
        const remotes = await listRemotes(root);
        const after = runGitSync(['remote', '-v'], root).stdout;

        expect(after).to.equal(before);
        expect(remotes.map(remote => remote.name).sort()).to.deep.equal(['artifacts', 'origin']);
        expect(hasExternalRemote(remotes)).to.equal(true);
    });

    it('initializes git on main only when missing and never stages files', async function () {
        const project = path.join(tempDir, 'fresh');
        fs.mkdirSync(project);
        writeFile(project, 'bkper.yaml', 'id: fresh-app\n');
        writeFile(project, 'README.md', 'hello\n');

        const created = await ensureGitInitialized(project);
        expect(created).to.equal(true);

        const branch = runGitSync(['branch', '--show-current'], project).stdout.trim();
        expect(branch).to.equal('main');

        const status = runGitSync(['status', '--porcelain'], project).stdout;
        expect(status).to.contain('bkper.yaml');
        expect(status).to.contain('README.md');
        expect(runGitSync(['rev-parse', '--verify', 'HEAD'], project).status).to.not.equal(0);

        const again = await ensureGitInitialized(project);
        expect(again).to.equal(false);
    });
});
