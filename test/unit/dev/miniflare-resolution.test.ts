import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { resolveMiniflareModulePath } from '../../../src/dev/miniflare.js';

function isResolvableFromAncestors(dir: string): boolean {
    try {
        resolveMiniflareModulePath(dir);
        return true;
    } catch {
        return false;
    }
}

describe('Miniflare module resolution', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miniflare-resolve-'));
    });

    afterEach(function () {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should resolve miniflare from the project node_modules', function () {
        const miniflareDir = path.join(tempDir, 'node_modules/miniflare');
        const entryPoint = path.join(miniflareDir, 'dist/src/index.js');

        fs.mkdirSync(path.dirname(entryPoint), { recursive: true });
        fs.writeFileSync(
            path.join(miniflareDir, 'package.json'),
            JSON.stringify(
                {
                    name: 'miniflare',
                    type: 'module',
                    main: './dist/src/index.js',
                },
                null,
                2
            )
        );
        fs.writeFileSync(entryPoint, 'export const marker = "project-miniflare";\n');

        const resolvedPath = resolveMiniflareModulePath(tempDir);

        expect(resolvedPath).to.equal(entryPoint);
    });

    it('should throw when miniflare cannot be resolved from the project root', function () {
        // Node resolution walks up parent directories, so a stray node_modules above
        // the OS temp dir (e.g. /tmp/node_modules/miniflare) makes this case unreachable.
        if (isResolvableFromAncestors(os.tmpdir())) {
            this.skip();
        }
        expect(() => resolveMiniflareModulePath(tempDir)).to.throw();
    });
});
