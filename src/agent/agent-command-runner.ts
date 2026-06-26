import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildAgentEntryCommandArgs(
    runnerPath: string,
    execArgv: string[],
    agentArgs: string[]
): string[] {
    const extension = path.extname(runnerPath) || '.js';
    const entryPath = path.join(path.dirname(runnerPath), `agent-entry${extension}`);
    return [...execArgv, entryPath, ...agentArgs];
}

export function runAgentCommandInChild(agentArgs: string[]): Promise<void> {
    const args = buildAgentEntryCommandArgs(
        fileURLToPath(import.meta.url),
        process.execArgv,
        agentArgs
    );

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { stdio: 'inherit' });

        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (signal) {
                process.exitCode = 1;
            } else if (code !== null && code !== 0) {
                process.exitCode = code;
            }
            resolve();
        });
    });
}
