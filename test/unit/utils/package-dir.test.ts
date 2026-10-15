import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect} from '../helpers/test-setup.js';
import {
    applyPiPackageDir,
    BKPER_PACKAGE_DIR,
    findPackageDir,
    getPiPackageDir,
} from '../../../src/utils/package-dir.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readPackageName(dir: string): string {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name;
}

describe('package dir', function () {
    let root: string;

    beforeEach(function () {
        root = mkdtempSync(path.join(tmpdir(), 'bkper-package-dir-'));
    });

    afterEach(function () {
        rmSync(root, {recursive: true, force: true});
    });

    it('finds the nearest package.json however deep the running file is', function () {
        writeFileSync(path.join(root, 'package.json'), '{}');
        const deepDir = path.join(root, 'lib', 'agent', 'bundle');
        mkdirSync(deepDir, {recursive: true});

        expect(findPackageDir(deepDir)).to.equal(root);
        expect(findPackageDir(path.join(root, 'lib'))).to.equal(root);
    });

    it('resolves the bkper package from source and compiled files alike', function () {
        expect(BKPER_PACKAGE_DIR).to.equal(REPO_ROOT);
        expect(readPackageName(BKPER_PACKAGE_DIR)).to.equal('bkper');
    });

    it('resolves the installed Pi package, where Pi keeps its version, themes, and docs', function () {
        expect(readPackageName(getPiPackageDir())).to.equal('@earendil-works/pi-coding-agent');
    });

    it('points Pi at its installed package without overriding a user setting', function () {
        const env: NodeJS.ProcessEnv = {};
        applyPiPackageDir(env);
        expect(env.PI_PACKAGE_DIR).to.equal(getPiPackageDir());

        const userEnv: NodeJS.ProcessEnv = {PI_PACKAGE_DIR: '/custom/pi'};
        applyPiPackageDir(userEnv);
        expect(userEnv.PI_PACKAGE_DIR).to.equal('/custom/pi');
    });
});
