import { expect } from '../helpers/test-setup.js';
import {
    assertInitTargetAvailable,
    removeTemplateLockfiles,
    resolveInitTarget,
} from '../../../src/commands/apps/init.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('app init target handling', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bkper-init-target-'));
    });

    afterEach(function () {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('resolves bkper app init to the current directory and derives the app name', function () {
        const projectDir = path.join(tempDir, 'punta-padel');
        fs.mkdirSync(projectDir);

        const target = resolveInitTarget(undefined, projectDir);

        expect(target.appName).to.equal('punta-padel');
        expect(target.targetDir).to.equal(projectDir);
        expect(target.displayTarget).to.equal('.');
    });

    it('resolves bkper app init <name> to a child directory with that app name', function () {
        const target = resolveInitTarget('custom-id', tempDir);

        expect(target.appName).to.equal('custom-id');
        expect(target.targetDir).to.equal(path.join(tempDir, 'custom-id'));
        expect(target.displayTarget).to.equal('custom-id');
    });

    it('allows VCS-only files when initializing the current directory', function () {
        fs.mkdirSync(path.join(tempDir, '.git'));
        fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n', 'utf8');
        fs.writeFileSync(path.join(tempDir, '.gitattributes'), '* text=auto\n', 'utf8');
        fs.mkdirSync(path.join(tempDir, '.pi'));

        expect(() =>
            assertInitTargetAvailable({
                appName: 'punta-padel',
                targetDir: tempDir,
                displayTarget: '.',
            })
        ).to.not.throw();
    });

    it('rejects current directories that already contain app or source files', function () {
        fs.writeFileSync(path.join(tempDir, 'README.md'), '# Existing app\n', 'utf8');

        expect(() =>
            assertInitTargetAvailable({
                appName: 'punta-padel',
                targetDir: tempDir,
                displayTarget: '.',
            })
        ).to.throw('Current directory contains files that are not safe to overwrite: README.md');
    });

    it('removes lockfiles after template extraction', function () {
        fs.writeFileSync(path.join(tempDir, 'bun.lock'), 'lock\n', 'utf8');
        fs.writeFileSync(path.join(tempDir, 'bun.lockb'), 'binary lock\n', 'utf8');

        removeTemplateLockfiles(tempDir);

        expect(fs.existsSync(path.join(tempDir, 'bun.lock'))).to.equal(false);
        expect(fs.existsSync(path.join(tempDir, 'bun.lockb'))).to.equal(false);
    });
});
