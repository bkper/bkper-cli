import {mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as directPiTui from '@earendil-works/pi-tui';
import {expect} from '../helpers/test-setup.js';
import {
    resolvePiSharedModulePaths,
    TuiAltScreen,
    typesafeSystemOneApi,
} from '../../../src/agent/pi-shared-modules.js';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src');
const SHARED_MODULES_FILE = path.join(SRC_DIR, 'agent', 'pi-shared-modules.ts');

function writePackage(dir: string, name: string, files: string[]): void {
    mkdirSync(dir, {recursive: true});
    writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({name, type: 'module', main: 'dist/index.js'})
    );
    for (const file of files) {
        mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
        writeFileSync(path.join(dir, file), 'export {};\n');
    }
}

function writePiPackages(nodeModules: string): void {
    writePackage(path.join(nodeModules, '@earendil-works', 'pi-tui'), '@earendil-works/pi-tui', [
        'dist/index.js',
    ]);
    writePackage(path.join(nodeModules, '@earendil-works', 'pi-ai'), '@earendil-works/pi-ai', [
        'dist/index.js',
        'dist/api/typesafe-system-one.lazy.js',
    ]);
}

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listSourceFiles(entryPath);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [entryPath] : [];
    });
}

describe('Pi shared modules', function () {
    let root: string;
    let codingAgentDir: string;
    let codingAgentEntry: string;

    beforeEach(function () {
        root = mkdtempSync(path.join(tmpdir(), 'bkper-pi-shared-'));
        codingAgentDir = path.join(root, 'node_modules', '@earendil-works', 'pi-coding-agent');
        writePackage(codingAgentDir, '@earendil-works/pi-coding-agent', ['dist/index.js']);
        codingAgentEntry = path.join(codingAgentDir, 'dist', 'index.js');
    });

    afterEach(function () {
        rmSync(root, {recursive: true, force: true});
    });

    it('uses the copies nested under pi-coding-agent when npm installs duplicates', function () {
        // npm follows pi-coding-agent's npm-shrinkwrap.json and nests its own copies next to the top-level ones.
        writePiPackages(path.join(root, 'node_modules'));
        const nested = path.join(codingAgentDir, 'node_modules');
        writePiPackages(nested);

        const paths = resolvePiSharedModulePaths(codingAgentEntry);

        expect(paths.tui).to.equal(path.join(nested, '@earendil-works', 'pi-tui', 'dist', 'index.js'));
        expect(paths.aiTypesafeSystemOne).to.equal(
            path.join(nested, '@earendil-works', 'pi-ai', 'dist', 'api', 'typesafe-system-one.lazy.js')
        );
    });

    it('uses the hoisted copies when there is a single install', function () {
        const hoisted = path.join(root, 'node_modules');
        writePiPackages(hoisted);

        const paths = resolvePiSharedModulePaths(codingAgentEntry);

        expect(paths.tui).to.equal(path.join(hoisted, '@earendil-works', 'pi-tui', 'dist', 'index.js'));
        expect(paths.aiTypesafeSystemOne).to.equal(
            path.join(hoisted, '@earendil-works', 'pi-ai', 'dist', 'api', 'typesafe-system-one.lazy.js')
        );
    });

    it('fails clearly when pi-ai cannot be found', function () {
        writePackage(path.join(codingAgentDir, 'node_modules', '@earendil-works', 'pi-tui'), '@earendil-works/pi-tui', [
            'dist/index.js',
        ]);

        expect(() => resolvePiSharedModulePaths(codingAgentEntry)).to.throw(
            'Cannot find @earendil-works/pi-ai'
        );
    });

    it('loads the installed pi-tui instance and pi-ai classifier', function () {
        expect(TuiAltScreen).to.equal(directPiTui.TuiAltScreen);
        expect(typesafeSystemOneApi().classify).to.be.a('function');
    });

    it('keeps runtime pi-tui and pi-ai imports in the shared modules file', function () {
        const runtimeImport = /^import\s+(?!type\s)[^;]*?from\s+'@earendil-works\/pi-(?:tui|ai)[^']*'/m;
        const offenders = listSourceFiles(SRC_DIR)
            .filter(file => file !== SHARED_MODULES_FILE)
            .filter(file => runtimeImport.test(readFileSync(file, 'utf8')))
            .map(file => path.relative(SRC_DIR, file));

        expect(offenders, 'import runtime values through src/agent/pi-shared-modules.ts').to.deep.equal(
            []
        );
    });
});
