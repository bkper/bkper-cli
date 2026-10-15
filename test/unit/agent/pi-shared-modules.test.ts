import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as directPiTui from '@earendil-works/pi-tui';
import {expect} from '../helpers/test-setup.js';
import {TuiAltScreen, typesafeSystemOneApi} from '../../../src/agent/pi-shared-modules.js';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src');
const SHARED_MODULES_FILE = path.join(SRC_DIR, 'agent', 'pi-shared-modules.ts');

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listSourceFiles(entryPath);
        return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [entryPath] : [];
    });
}

describe('Pi shared modules', function () {
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
