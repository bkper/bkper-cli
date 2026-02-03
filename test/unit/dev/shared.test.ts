import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildSharedIfPresent } from '../../../src/dev/shared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to CLI's node_modules/typescript (used to symlink into temp projects)
const cliRoot = path.resolve(__dirname, '../../..');
const cliTypescriptPath = path.join(cliRoot, 'node_modules/typescript');

/**
 * Sets up a temp project with TypeScript available in node_modules.
 * Uses symlink to avoid copying the entire typescript package.
 */
function setupProjectWithTypeScript(tempDir: string): void {
    const nodeModulesPath = path.join(tempDir, 'node_modules');
    fs.mkdirSync(nodeModulesPath, { recursive: true });

    // Symlink typescript from CLI's node_modules
    const tsSymlinkPath = path.join(nodeModulesPath, 'typescript');
    if (!fs.existsSync(tsSymlinkPath)) {
        fs.symlinkSync(cliTypescriptPath, tsSymlinkPath, 'dir');
    }
}

describe('Shared package build helper', function () {
    let tempDir: string;

    beforeEach(function () {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-build-'));
    });

    afterEach(function () {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should be a no-op when shared package is missing', async function () {
        const result = await buildSharedIfPresent(tempDir);

        expect(result.built).to.equal(false);
        expect(result.success).to.equal(true);
    });

    it('should return error when TypeScript is not installed', async function () {
        const sharedDir = path.join(tempDir, 'packages/shared');
        const srcDir = path.join(sharedDir, 'src');

        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(
            path.join(sharedDir, 'tsconfig.json'),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'ESNext',
                        moduleResolution: 'bundler',
                        declaration: true,
                        outDir: 'dist',
                        rootDir: 'src',
                    },
                    include: ['src/**/*'],
                },
                null,
                2
            )
        );

        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const sharedValue = 42;\n');

        const result = await buildSharedIfPresent(tempDir);

        expect(result.built).to.equal(false);
        expect(result.success).to.equal(false);
        expect(result.diagnostics).to.include(
            'TypeScript not found. Run bun install at the app root (required for shared package build).'
        );
    });

    it('should build shared package when present and TypeScript is installed', async function () {
        setupProjectWithTypeScript(tempDir);

        const sharedDir = path.join(tempDir, 'packages/shared');
        const srcDir = path.join(sharedDir, 'src');

        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(
            path.join(sharedDir, 'tsconfig.json'),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'ESNext',
                        moduleResolution: 'bundler',
                        declaration: true,
                        outDir: 'dist',
                        rootDir: 'src',
                    },
                    include: ['src/**/*'],
                },
                null,
                2
            )
        );

        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const sharedValue = 42;\n');

        const result = await buildSharedIfPresent(tempDir);

        expect(result.built).to.equal(true);
        expect(result.success).to.equal(true);
        expect(fs.existsSync(path.join(sharedDir, 'dist/index.js'))).to.equal(true);
        expect(fs.existsSync(path.join(sharedDir, 'dist/index.d.ts'))).to.equal(true);
    });

    it('should return diagnostics when build fails', async function () {
        setupProjectWithTypeScript(tempDir);

        const sharedDir = path.join(tempDir, 'packages/shared');
        const srcDir = path.join(sharedDir, 'src');

        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(
            path.join(sharedDir, 'tsconfig.json'),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'ESNext',
                        moduleResolution: 'bundler',
                        declaration: true,
                        outDir: 'dist',
                        rootDir: 'src',
                    },
                    include: ['src/**/*'],
                },
                null,
                2
            )
        );

        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const x = ;\n');

        const result = await buildSharedIfPresent(tempDir);

        expect(result.built).to.equal(true);
        expect(result.success).to.equal(false);
        expect(result.diagnostics && result.diagnostics.length > 0).to.equal(true);
    });
});
