import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds run the bundled agent, which loads a few files instead of ~1,600 and starts much faster.
 * Without a bundle (`tsc --watch`) the compiled entrypoint runs, and ts-node runs the source.
 */
export function buildAgentEntryCommandArgs(
    runnerPath: string,
    execArgv: string[],
    agentArgs: string[],
    exists: (file: string) => boolean = existsSync
): string[] {
    const extension = path.extname(runnerPath) || '.js';
    const runnerDir = path.dirname(runnerPath);
    const bundledEntryPath = path.join(runnerDir, 'bundle', 'agent-entry.js');
    const entryPath =
        extension === '.js' && exists(bundledEntryPath)
            ? bundledEntryPath
            : path.join(runnerDir, `agent-entry${extension}`);
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
