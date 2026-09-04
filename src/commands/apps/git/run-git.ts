import {spawn} from 'child_process';
import {ManagedGitError} from './types.js';

export interface GitCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface GitRunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    allowFailure?: boolean;
    input?: string;
}

export type GitRunner = (
    args: string[],
    options?: GitRunOptions
) => Promise<GitCommandResult>;

/**
 * Runs a git subprocess. Never logs secrets from env or stdout.
 */
export async function runGit(
    args: string[],
    options: GitRunOptions = {}
): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, {
            cwd: options.cwd,
            env: {
                ...process.env,
                ...options.env,
                GIT_TERMINAL_PROMPT: '0',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer | string) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer | string) => {
            stderr += chunk.toString();
        });

        if (options.input !== undefined) {
            child.stdin.write(options.input);
        }
        child.stdin.end();

        child.on('error', error => {
            reject(
                new ManagedGitError(
                    'GIT_COMMAND_FAILED',
                    `Failed to run git ${args[0] ?? ''}: ${error.message}`
                )
            );
        });

        child.on('close', code => {
            const exitCode = code ?? 1;
            const result = {stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode};
            if (exitCode !== 0 && !options.allowFailure) {
                reject(
                    new ManagedGitError(
                        'GIT_COMMAND_FAILED',
                        formatGitFailure(args, result)
                    )
                );
                return;
            }
            resolve(result);
        });
    });
}

export function formatGitFailure(args: string[], result: GitCommandResult): string {
    const detail = result.stderr || result.stdout || `exit ${result.exitCode}`;
    // Never include credential helper password protocol output in errors.
    const redacted = detail
        .split('\n')
        .filter(line => !/^(username|password)=/i.test(line.trim()))
        .join('\n')
        .trim();
    return `git ${args.join(' ')} failed: ${redacted || `exit ${result.exitCode}`}`;
}
