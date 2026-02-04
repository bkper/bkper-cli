import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Logger } from './logger.js';

export interface TunnelHandle {
    url: string;
    stop(): Promise<void>;
}

export interface CloudflaredTunnelOptions {
    port: number;
    logger?: Logger;
}

export function extractCloudflaredUrl(output: string): string | undefined {
    const match = output.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
    return match ? match[0] : undefined;
}

interface CloudflaredCommand {
    command: string;
    argsPrefix: string[];
}

function isCommandAvailable(command: string): boolean {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return !result.error;
}

function resolveCloudflaredCommand(rootDir: string): CloudflaredCommand {
    const binName = process.platform === 'win32' ? 'cloudflared.cmd' : 'cloudflared';
    const localBin = path.join(rootDir, 'node_modules', '.bin', binName);

    if (fs.existsSync(localBin)) {
        return { command: localBin, argsPrefix: [] };
    }

    if (isCommandAvailable('bunx')) {
        return { command: 'bunx', argsPrefix: ['cloudflared'] };
    }

    if (isCommandAvailable('npx')) {
        return { command: 'npx', argsPrefix: ['--yes', 'cloudflared'] };
    }

    throw new Error('cloudflared not found. Install it with `bun add -D cloudflared` or `npm i -D cloudflared`.');
}

export async function startCloudflaredTunnel(options: CloudflaredTunnelOptions): Promise<TunnelHandle> {
    const { command, argsPrefix } = resolveCloudflaredCommand(process.cwd());
    const args = [...argsPrefix, 'tunnel', '--url', `http://localhost:${options.port}`];
    options.logger?.info(`Starting tunnel via ${command}...`);
    const childProcess = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
    });

    let buffer = '';
    const url = await new Promise<string>((resolve, reject) => {
        if (!childProcess.stdout || !childProcess.stderr) {
            reject(new Error('cloudflared did not provide output streams'));
            return;
        }

        const stdout = childProcess.stdout;
        const stderr = childProcess.stderr;

        const onData = (data: Buffer) => {
            const chunk = data.toString();
            buffer += chunk;
            const urlMatch = extractCloudflaredUrl(buffer);
            if (urlMatch) {
                clearTimeout(timeout);
                stdout.off('data', onData);
                stderr.off('data', onData);
                resolve(urlMatch);
            }
        };

        const timeout = setTimeout(() => {
            stdout.off('data', onData);
            stderr.off('data', onData);
            reject(new Error('Timed out waiting for tunnel URL'));
        }, 15000);

        stdout.on('data', onData);
        stderr.on('data', onData);

        childProcess.once('error', err => {
            clearTimeout(timeout);
            stdout.off('data', onData);
            stderr.off('data', onData);
            reject(err);
        });

        childProcess.once('exit', code => {
            if (code !== 0) {
                clearTimeout(timeout);
                stdout.off('data', onData);
                stderr.off('data', onData);
                reject(new Error(`cloudflared exited with code ${code ?? 'unknown'}`));
            }
        });
    });

    options.logger?.info(`Tunnel assigned: ${url}`);

    return {
        url,
        async stop(): Promise<void> {
            await stopTunnelProcess(childProcess);
        },
    };
}

function stopTunnelProcess(process: ReturnType<typeof spawn> | null): Promise<void> {
    return new Promise(resolve => {
        if (!process || process.killed) {
            resolve();
            return;
        }

        const pid = process.pid;
        if (!pid) {
            resolve();
            return;
        }

        let resolved = false;
        const safeResolve = () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(forceKillTimeout);
                clearTimeout(hardTimeout);
                resolve();
            }
        };

        process.once('exit', safeResolve);
        terminateProcessTree(pid);

        // Force kill if graceful termination fails
        const forceKillTimeout = setTimeout(() => {
            if (!process.killed) {
                terminateProcessTree(pid, true);
            }
        }, 2000);

        // Hard timeout: resolve regardless of process state to prevent hanging
        const hardTimeout = setTimeout(() => {
            safeResolve();
        }, 3000);
    });
}

function terminateProcessTree(pid: number, force = false): void {
    if (process.platform === 'win32') {
        const args = ['/pid', pid.toString(), '/T'];
        if (force) {
            args.push('/F');
        }
        spawnSync('taskkill', args, { stdio: 'ignore' });
        return;
    }

    const signal = force ? 'SIGKILL' : 'SIGINT';
    try {
        process.kill(-pid, signal);
    } catch (err) {
        try {
            process.kill(pid, signal);
        } catch {
            // ignore
        }
    }
}
