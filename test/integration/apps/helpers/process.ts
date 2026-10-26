import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const USE_PROCESS_GROUPS = process.platform !== 'win32';
const runningChildren = new Set<ChildProcess>();

/**
 * Signals a child and every process it started. Children run in their own process group, so a
 * stopped test leaves no build, install, or dev server processes behind.
 */
export function killProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
    if (child.pid === undefined) return;
    try {
        if (USE_PROCESS_GROUPS) {
            process.kill(-child.pid, signal);
            return;
        }
    } catch {
        // The group already exited; fall through to the child itself.
    }
    child.kill(signal);
}

process.once('exit', () => {
    for (const child of runningChildren) {
        killProcessTree(child, 'SIGKILL');
    }
});

/** Spawns a child in its own process group, tracked so it is killed when the test run exits. */
export function spawnTracked(command: string, args: string[], options: SpawnOptions): ChildProcess {
    const child = spawn(command, args, { ...options, detached: USE_PROCESS_GROUPS });
    runningChildren.add(child);
    child.once('exit', () => runningChildren.delete(child));
    return child;
}

/**
 * Run a command and wait for completion. A command still running after `timeoutMs` is killed
 * with everything it started, and the returned promise rejects.
 */
export async function runCommand(
    command: string,
    args: string[],
    cwd: string,
    envOverrides?: Record<string, string>,
    timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const commandLine = `${command} ${args.join(' ')}`;
        const child = spawnTracked(command, args, {
            cwd,
            env: { ...process.env, ...(envOverrides || {}) },
            stdio: 'pipe',
        });

        let stderr = '';
        child.stderr?.on('data', chunk => {
            stderr += chunk.toString();
        });

        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            killProcessTree(child, 'SIGKILL');
        }, timeoutMs);

        child.on('error', error => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (timedOut) {
                reject(
                    new Error(
                        `Command timed out after ${timeoutMs / 1000}s (${commandLine}): ${stderr.slice(-2000)}`
                    )
                );
            } else if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed (${commandLine}): ${stderr}`));
            }
        });
    });
}

/**
 * Gracefully stop a process and everything it started, escalating to SIGKILL if needed
 */
export async function stopProcess(child: ChildProcess, timeoutMs: number): Promise<void> {
    if (child.exitCode !== null) return;

    let exited = false;
    const exitPromise = new Promise<void>(resolve => {
        child.once('exit', () => {
            exited = true;
            resolve();
        });
    });

    killProcessTree(child, 'SIGINT');

    const timeout = new Promise<void>(resolve => {
        setTimeout(resolve, timeoutMs);
    });

    await Promise.race([exitPromise, timeout]);

    // Also stops anything the child left running after it exited.
    killProcessTree(child, 'SIGKILL');
    if (!exited) {
        await exitPromise;
    }
}
