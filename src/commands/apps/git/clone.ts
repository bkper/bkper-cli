import fs from 'fs';
import os from 'os';
import path from 'path';
import * as YAML from 'yaml';
import {runGit, type GitRunner} from './run-git.js';
import {
    createPlatformSourceApi,
    stripRepositoryTokenSecret,
    type PlatformSourceApi,
} from './platform-source.js';
import {configureManagedOrigin} from './remote.js';
import {writeManagedSourceMarker} from './markers.js';
import {ManagedGitError} from './types.js';

export interface CloneManagedAppOptions {
    appId: string;
    destination?: string;
    cwd?: string;
    api?: PlatformSourceApi;
    runner?: GitRunner;
    /** Test-only: skip real network clone and use this factory. */
    cloneImpl?: (args: {
        remote: string;
        token: string;
        tempDir: string;
        runner: GitRunner;
    }) => Promise<void>;
}

function resolveDestination(appId: string, destination: string | undefined, cwd: string): string {
    if (destination) {
        return path.resolve(cwd, destination);
    }
    return path.resolve(cwd, appId);
}

function readClonedAppId(repoDir: string): string | undefined {
    for (const fileName of ['bkper.yaml', 'bkper.json']) {
        const fullPath = path.join(repoDir, fileName);
        if (!fs.existsSync(fullPath)) {
            continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const config = fileName.endsWith('.json')
            ? (JSON.parse(content) as {id?: unknown})
            : (YAML.parse(content) as {id?: unknown});
        if (typeof config?.id === 'string') {
            return config.id;
        }
    }
    return undefined;
}

async function cloneWithReadToken(args: {
    remote: string;
    token: string;
    tempDir: string;
    runner: GitRunner;
}): Promise<void> {
    const password = stripRepositoryTokenSecret(args.token);
    // Use an absolute credential helper so the token never appears in argv or remote URL.
    const helperScript = [
        '#!/bin/sh',
        'set -eu',
        '[ "${1:-}" = "get" ] || exit 0',
        'printf "username=x\\npassword=%s\\n" "$BKPER_CLONE_TOKEN"',
        '',
    ].join('\n');
    const helperPath = path.join(os.tmpdir(), `bkper-clone-helper-${process.pid}-${Date.now()}.sh`);
    fs.writeFileSync(helperPath, helperScript, {mode: 0o700});
    try {
        await args.runner(
            [
                '-c',
                'credential.helper=',
                '-c',
                `credential.helper=${helperPath}`,
                'clone',
                '--branch',
                'main',
                args.remote,
                args.tempDir,
            ],
            {
                env: {
                    ...process.env,
                    BKPER_CLONE_TOKEN: password,
                    GIT_TERMINAL_PROMPT: '0',
                },
            }
        );
    } finally {
        fs.rmSync(helperPath, {force: true});
    }
}

/**
 * Atomically clones a managed App source repository.
 * Never installs dependencies or executes repository lifecycle scripts.
 */
export async function cloneManagedApp(options: CloneManagedAppOptions): Promise<string> {
    const cwd = options.cwd ?? process.cwd();
    const destination = resolveDestination(options.appId, options.destination, cwd);
    const runner = options.runner ?? runGit;
    const api = options.api ?? createPlatformSourceApi();

    if (fs.existsSync(destination)) {
        throw new ManagedGitError(
            'CLONE_DESTINATION_EXISTS',
            [
                `Destination already exists: ${destination}`,
                'Choose another path or remove the existing directory, then retry:',
                `  bkper app clone ${options.appId} <path>`,
            ].join('\n')
        );
    }

    const status = await api.getStatus(options.appId);
    if (status === 'feature_disabled') {
        throw new ManagedGitError(
            'MANAGED_SOURCE_UNAVAILABLE',
            'Managed source control is not enabled in this Platform environment.'
        );
    }
    if (status === 'app_not_found' || status.mode !== 'managed') {
        throw new ManagedGitError(
            'EXTERNAL_SOURCE_CLONE',
            [
                `App '${options.appId}' does not use Bkper-managed source.`,
                'Clone it from its external Git provider (GitHub, GitLab, etc.).',
                'If the App publishes a repository URL, use that provider clone command instead of `bkper app clone`.',
            ].join('\n')
        );
    }

    const credential = await api.issueCredential(options.appId, 'read');
    const parentDir = path.dirname(destination);
    fs.mkdirSync(parentDir, {recursive: true});
    const tempDir = fs.mkdtempSync(path.join(parentDir, `.${options.appId}-clone-`));

    try {
        const cloneImpl = options.cloneImpl ?? cloneWithReadToken;
        try {
            await cloneImpl({
                remote: credential.remote,
                token: credential.token,
                tempDir,
                runner,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/empty|not found|could not find remote|Remote branch main not found/i.test(message)) {
                throw new ManagedGitError(
                    'CLONE_EMPTY_REPOSITORY',
                    [
                        `Managed repository for '${options.appId}' has no commit on main yet.`,
                        'Ask the App owner to complete the first managed sync/push, then retry clone.',
                    ].join('\n')
                );
            }
            throw error;
        }

        const clonedAppId = readClonedAppId(tempDir);
        if (!clonedAppId) {
            throw new ManagedGitError(
                'APP_ID_MISMATCH',
                'Cloned repository is missing bkper.yaml/bkper.json with an id field.'
            );
        }
        if (clonedAppId !== options.appId) {
            throw new ManagedGitError(
                'APP_ID_MISMATCH',
                [
                    'Cloned bkper.yaml id does not match the requested App ID.',
                    `Requested: ${options.appId}`,
                    `Found:     ${clonedAppId}`,
                ].join('\n')
            );
        }

        await configureManagedOrigin(tempDir, credential.remote, options.appId, runner);
        writeManagedSourceMarker(tempDir, options.appId, credential.remote);

        fs.renameSync(tempDir, destination);
        return destination;
    } catch (error) {
        fs.rmSync(tempDir, {recursive: true, force: true});
        throw error;
    }
}

export async function cloneManagedAppCommand(
    appId: string,
    destination?: string
): Promise<void> {
    const dest = await cloneManagedApp({appId, destination});
    console.log(`Cloned managed App '${appId}' into ${dest}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${path.relative(process.cwd(), dest) || '.'}`);
    console.log("  Install dependencies using the project's package manager.");
    console.log('');
    console.log('Clone never installs dependencies or runs repository scripts.');
}
