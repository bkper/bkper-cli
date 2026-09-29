import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {expect} from './helpers/test-setup.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CLI_SOURCE_PATH = path.join(REPO_ROOT, 'src/cli.ts');

interface ProcessResult {
    exitCode: number | null;
    stderr: string;
}

function runCliWithEnvironment(env: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--loader', 'ts-node/esm', CLI_SOURCE_PATH], {
            cwd: REPO_ROOT,
            env,
            stdio: ['ignore', 'ignore', 'pipe'],
        });

        let stderr = '';

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', chunk => {
            stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', exitCode => {
            resolve({exitCode, stderr});
        });
    });
}

async function writeFakePackageManager(binDir: string, name: string): Promise<void> {
    const scriptPath = path.join(binDir, name);
    await fs.writeFile(scriptPath, '#!/usr/bin/env node\nconsole.log("bkper@4.0.0");\n', {
        mode: 0o755,
    });
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function waitForInstallDecision(cacheDir: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            for (const file of await fs.readdir(cacheDir)) {
                if (!file.endsWith('.json')) continue;
                const content = await fs.readFile(path.join(cacheDir, file), 'utf8');
                if (content.includes('"install"')) {
                    return content;
                }
            }
        } catch {
            // Cache not written yet
        }
        await wait(100);
    }
    throw new Error('Update worker did not record an install decision in time');
}

describe('cli autoupdate startup', function () {
    it('should never install from a plain command when the running copy is not a global install', async function () {
        this.timeout(30000);
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bkper-cli-autoupdate-'));
        const fakeBinDir = path.join(tempDir, 'bin');
        const homeDir = path.join(tempDir, 'home');
        const writerPath = path.join(tempDir, 'write-marker.mjs');
        const markerPath = path.join(tempDir, 'autoupdate-started');
        await fs.mkdir(fakeBinDir);
        await fs.mkdir(homeDir);
        await Promise.all([
            writeFakePackageManager(fakeBinDir, 'bun'),
            writeFakePackageManager(fakeBinDir, 'npm'),
            writeFakePackageManager(fakeBinDir, 'pnpm'),
            writeFakePackageManager(fakeBinDir, 'yarn'),
        ]);
        await fs.writeFile(
            writerPath,
            'import fs from "node:fs";\nfs.writeFileSync(process.argv[2], "started");\n'
        );

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            HOME: homeDir,
            USERPROFILE: homeDir,
            PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
            TS_NODE_PROJECT: path.join(REPO_ROOT, 'tsconfig.test.json'),
            BKPER_AUTOUPDATE_LATEST_VERSION: '999.0.0',
            BKPER_AUTOUPDATE_COMMAND: `${JSON.stringify(process.execPath)} ${JSON.stringify(
                writerPath
            )} ${JSON.stringify(markerPath)}`,
        };
        delete env.BKPER_DISABLE_AUTOUPDATE;
        delete env.CI;
        delete env.TS_NODE_TRANSPILE_ONLY;

        try {
            const first = await runCliWithEnvironment(env);
            expect(first.exitCode).to.equal(0, first.stderr);

            const decision = await waitForInstallDecision(
                path.join(homeDir, '.config', 'bkper', 'update-check'),
                20000
            );
            expect(decision).to.contain('"status":"manual"');
            expect(await fileExists(markerPath)).to.equal(false);

            const second = await runCliWithEnvironment(env);
            expect(second.exitCode).to.equal(0, second.stderr);
            expect(second.stderr).to.contain('bkper 999.0.0 available');
            expect(await fileExists(markerPath)).to.equal(false);
        } finally {
            await fs.rm(tempDir, {recursive: true, force: true});
        }
    });
});
