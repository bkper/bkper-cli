import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from '../helpers/test-setup.js';
import { runCommand } from '../../integration/apps/helpers/process.js';

function isRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!(await condition())) {
        if (Date.now() > deadline) throw new Error('Condition not met in time');
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

describe('integration harness runCommand', function () {
    if (process.platform === 'win32') return;

    it('fails a hung command and stops everything it started', async function () {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bkper-run-command-'));
        const pidFile = path.join(dir, 'grandchild.pid');

        try {
            let error: unknown;
            try {
                await runCommand(
                    'sh',
                    ['-c', `sleep 30 & echo $! > ${JSON.stringify(pidFile)}; wait`],
                    dir,
                    undefined,
                    500
                );
            } catch (caught) {
                error = caught;
            }

            expect(error).to.be.instanceOf(Error);
            expect((error as Error).message).to.contain('Command timed out after 0.5s');
            const grandchildPid = Number(await fs.readFile(pidFile, 'utf8'));
            await waitFor(async () => !isRunning(grandchildPid), 2000);
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it('resolves a command that succeeds', async function () {
        await runCommand('sh', ['-c', 'exit 0'], os.tmpdir());
    });
});
