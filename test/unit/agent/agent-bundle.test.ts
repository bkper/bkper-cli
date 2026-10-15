import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect} from '../helpers/test-setup.js';
import {
    buildAgentBundle,
    PACKAGES_RESOLVED_FROM_BKPER,
} from '../../../scripts/build-agent-bundle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readJson(file: string): {version: string; dependencies: Record<string, string>} {
    return JSON.parse(readFileSync(file, 'utf8'));
}

describe('agent bundle', function () {
    this.timeout(120_000);

    let packageDir: string;
    let outDir: string;
    let files: string[];

    before(async function () {
        // Lay the bundle out as in an installed package: lib/agent/bundle under a package root.
        packageDir = mkdtempSync(path.join(tmpdir(), 'bkper-agent-bundle-'));
        copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(packageDir, 'package.json'));
        symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(packageDir, 'node_modules'), 'dir');
        outDir = path.join(packageDir, 'lib', 'agent', 'bundle');
        ({files} = await buildAgentBundle({outDir}));
    });

    after(function () {
        rmSync(packageDir, {recursive: true, force: true});
    });

    it('emits the files Pi loads from beside its code at runtime', function () {
        expect(files).to.include.members([
            'agent-entry.js',
            'update-worker.js',
            'codemode-worker.js',
            'image-resize-worker.js',
            'bedrock-converse-stream.js',
            'anthropic.js',
            'openai-codex.js',
        ]);
    });

    it('starts the bundled agent with Pi reading its own installed package', function () {
        const env = {...process.env};
        delete env.PI_PACKAGE_DIR;

        const output = execFileSync(process.execPath, [path.join(outDir, 'agent-entry.js'), '--version'], {
            env,
            encoding: 'utf8',
        });

        const piVersion = readJson(
            path.join(REPO_ROOT, 'node_modules', '@earendil-works', 'pi-coding-agent', 'package.json')
        ).version;
        expect(output.trim()).to.equal(piVersion);
    });

    it("pins the packages the bundle resolves from bkper's node_modules to Pi's versions", function () {
        const bkperDependencies = readJson(path.join(REPO_ROOT, 'package.json')).dependencies;
        const piDependencies = readJson(
            path.join(REPO_ROOT, 'node_modules', '@earendil-works', 'pi-coding-agent', 'package.json')
        ).dependencies;

        for (const name of PACKAGES_RESOLVED_FROM_BKPER) {
            expect(bkperDependencies[name], name).to.equal(piDependencies[name]);
        }
    });
});
